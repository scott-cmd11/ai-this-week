import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { captureArticleToTodaysDraft, type CaptureArticleInput } from '@/lib/issue-store'
import { generateAnnotation } from '@/lib/ai-annotation'
import { fetchArticleMeta, isPublishedDateFreshForIssue } from '@/lib/article-fetcher'
import { categoryForArticle, CATEGORY_ORDER } from '@/lib/category-mapping'
import { buildKnownTitleList, buildKnownUrlMap } from '@/lib/known-urls'
import { normalizeUrl } from '@/lib/url-normalize'
import { chooseSourceTitle, type TitleQualityWarning } from '@/lib/title-quality'
import { issueDateFor } from '@/lib/issue-date'
import { findSubjectDuplicate, subjectDuplicateMessage } from '@/lib/article-dedupe'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface IncomingArticle {
  title: string
  summary: string         // briefing's pre-written summary (used as fallback)
  url: string
  imageUrl?: string | null
  category?: string | null  // canonical category — articles get sorted by this
}

interface RequestBody {
  adminPassword?: string
  articles?: IncomingArticle[]
  /** When true, run each article's annotation through OpenAI in the AI Today voice. */
  rewriteWithAi?: boolean
}

interface ArticleResult {
  url: string
  title: string
  ok: boolean
  error?: string
  skippedReason?: string
  warnings?: TitleQualityWarning[]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!Array.isArray(body.articles) || body.articles.length === 0) {
    return NextResponse.json({ error: 'No articles provided.' }, { status: 400 })
  }

  const rewriteWithAi = body.rewriteWithAi === true
  if (rewriteWithAi && !openaiApiKey) {
    return NextResponse.json(
      { error: 'AI rewrite requested but OPENAI_API_KEY is not configured.' },
      { status: 500 },
    )
  }

  const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null
  const issueDate = issueDateFor()
  const [knownUrls, knownTitles] = await Promise.all([
    buildKnownUrlMap(30),
    buildKnownTitleList(30),
  ])
  const seenThisImport = new Set<string>()
  const importedTitlesThisBatch: Array<{ title: string }> = []

  // Sort articles by canonical category order so each h2 section gets all its
  // articles in one contiguous batch (avoids duplicate "## Canada" headings
  // when articles arrive interleaved by source).
  const categoryRank = new Map<string, number>()
  CATEGORY_ORDER.forEach((c, i) => categoryRank.set(c, i))
  const sortedArticles = body.articles.map(article => ({
    ...article,
    category: categoryForArticle({
      title: article.title,
      summary: article.summary,
      url: article.url,
      category: article.category,
    }, article.category),
  })).sort((a, b) => {
    const ra = categoryRank.get(a?.category ?? '') ?? Number.MAX_SAFE_INTEGER
    const rb = categoryRank.get(b?.category ?? '') ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })

  // Process sequentially — preserves order in Notion AND avoids hammering
  // OpenAI/Notion rate limits when rewriteWithAi multiplies the work
  const results: ArticleResult[] = []
  let lastArticleCount = 0
  let lastIssueId: string | null = null
  let lastIssueNumber = 0
  let lastIssueDate = ''

  for (const article of sortedArticles) {
    if (!article?.url || !article.url.startsWith('http')) {
      results.push({ url: article?.url ?? '', title: article?.title ?? '', ok: false, error: 'Invalid URL' })
      continue
    }

    const articleUrl = article.url.trim()
    const normalizedUrl = normalizeUrl(articleUrl)
    if (!normalizedUrl) {
      results.push({ url: articleUrl, title: article.title?.trim() || articleUrl, ok: false, error: 'Invalid URL' })
      continue
    }

    if (knownUrls.has(normalizedUrl) || seenThisImport.has(normalizedUrl)) {
      results.push({
        url: articleUrl,
        title: article.title?.trim() || articleUrl,
        ok: false,
        skippedReason: 'Duplicate source URL already exists in a recent issue or this import batch.',
      })
      continue
    }
    seenThisImport.add(normalizedUrl)

    // Auto-fetch publisher metadata when briefings omit it. This keeps future
    // issues visually richer, gives readers source timing when available, and
    // catches briefing titles that were truncated in source notes.
    let resolvedImageUrl = article.imageUrl?.trim() || null
    let resolvedTitle = article.title?.trim() || articleUrl
    let resolvedPublishedDate: string | null = null
    let warnings: TitleQualityWarning[] = []
    if (!resolvedImageUrl || !resolvedPublishedDate) {
      try {
        const meta = await fetchArticleMeta(articleUrl)
        const titleChoice = chooseSourceTitle(resolvedTitle, meta.title)
        resolvedTitle = titleChoice.title
        warnings = titleChoice.warnings
        resolvedImageUrl = resolvedImageUrl ?? meta.imageUrl
        resolvedPublishedDate = meta.publishedDate
      } catch {
        // Image fetch is best-effort — if it fails, the article still
        // imports without one and renders as a quiet text-only entry.
      }
    }

    if (!isPublishedDateFreshForIssue(resolvedPublishedDate, issueDate)) {
      results.push({
        url: articleUrl,
        title: article.title?.trim() || articleUrl,
        ok: false,
        skippedReason: `Publisher date is older than the daily freshness window: ${resolvedPublishedDate}`,
      })
      continue
    }

    const subjectDuplicate = findSubjectDuplicate(resolvedTitle, knownTitles, importedTitlesThisBatch)
    if (subjectDuplicate.duplicate) {
      results.push({
        url: articleUrl,
        title: resolvedTitle,
        ok: false,
        skippedReason: subjectDuplicateMessage(subjectDuplicate) ?? 'Similar subject already exists.',
      })
      continue
    }

    // If rewriting: replace the briefing's summary with an AI Today-voiced one.
    // The briefing summary is passed as a fallback so the model has context
    // even if the URL fetch fails (e.g. paywalled article).
    let annotation = article.summary?.trim() || '[Add annotation]'
    if (rewriteWithAi && openai) {
      try {
        annotation = await generateAnnotation(openai, articleUrl, {
          knownTitle: article.title,
          fallbackSummary: article.summary,
        })
      } catch {
        // generateAnnotation already swallows its own errors and returns a
        // sensible default, but guard here just in case.
        annotation = article.summary?.trim() || '[Add annotation]'
      }
    }

    const input: CaptureArticleInput = {
      title: resolvedTitle,
      annotation,
      url: articleUrl,
      publishedDate: resolvedPublishedDate,
      imageUrl: resolvedImageUrl,
      category: categoryForArticle({
        title: resolvedTitle,
        summary: article.summary,
        annotation,
        url: articleUrl,
        category: article.category,
      }, article.category),
    }

    try {
      const result = await captureArticleToTodaysDraft(input)
      lastArticleCount = result.articleCount
      lastIssueId = result.issueId
      lastIssueNumber = result.issueNumber
      lastIssueDate = result.issueDate
      results.push({ url: input.url, title: input.title, ok: true, warnings })
      importedTitlesThisBatch.push({ title: input.title })
    } catch (err) {
      results.push({
        url: input.url,
        title: input.title,
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const added = results.filter(r => r.ok).length

  return NextResponse.json({
    added,
    attempted: results.length,
    rewroteWithAi: rewriteWithAi,
    articleCount: lastArticleCount,
    issueId: lastIssueId,
    issueNumber: lastIssueNumber,
    issueDate: lastIssueDate,
    results,
  })
}
