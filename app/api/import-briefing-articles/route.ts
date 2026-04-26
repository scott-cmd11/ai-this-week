import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { captureArticleToTodaysDraft, type CaptureArticleInput } from '@/lib/notion-capture'
import { generateAnnotation } from '@/lib/ai-annotation'
import { CATEGORY_ORDER } from '@/lib/category-mapping'

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
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !notionToken || !notionDatabaseId) {
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

  const notion = new Client({ auth: notionToken })
  const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null

  // Sort articles by canonical category order so each h2 section gets all its
  // articles in one contiguous batch (avoids duplicate "## Canada" headings
  // when articles arrive interleaved by source).
  const categoryRank = new Map<string, number>()
  CATEGORY_ORDER.forEach((c, i) => categoryRank.set(c, i))
  const sortedArticles = [...body.articles].sort((a, b) => {
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

    // If rewriting: replace the briefing's summary with an AI Today-voiced one.
    // The briefing summary is passed as a fallback so the model has context
    // even if the URL fetch fails (e.g. paywalled article).
    let annotation = article.summary?.trim() || '[Add annotation]'
    if (rewriteWithAi && openai) {
      try {
        annotation = await generateAnnotation(openai, article.url, {
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
      title: article.title?.trim() || article.url,
      annotation,
      url: article.url.trim(),
      imageUrl: article.imageUrl?.trim() || null,
      category: article.category?.trim() || null,
    }

    try {
      const result = await captureArticleToTodaysDraft(notion, notionDatabaseId, input)
      lastArticleCount = result.articleCount
      lastIssueId = result.issueId
      lastIssueNumber = result.issueNumber
      lastIssueDate = result.issueDate
      results.push({ url: input.url, title: input.title, ok: true })
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
