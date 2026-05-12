import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { revalidatePath } from 'next/cache'
import { parseBriefingBlocks } from '@/lib/briefing-parser'
import { categorize, CATEGORY_ORDER } from '@/lib/category-mapping'
import { generateAnnotation } from '@/lib/ai-annotation'
import { fetchArticleMeta, isPublishedDateFreshForIssue } from '@/lib/article-fetcher'
import { captureArticleToDraftDate, type CaptureArticleInput } from '@/lib/issue-store'
import { buildKnownTitleList, buildKnownUrlMap } from '@/lib/known-urls'
import { normalizeUrl } from '@/lib/url-normalize'
import { fetchResearchPapersForDate } from '@/lib/research-papers'
import { issueDateFor } from '@/lib/issue-date'
import { chooseSourceTitle } from '@/lib/title-quality'
import { findSubjectDuplicate } from '@/lib/article-dedupe'
import { fetchAiVoicesArticles } from '@/lib/ai-voices-direct'

type SourceType = 'page' | 'database'

interface SourceConfig {
  id: string
  label: string
  type: SourceType
  dateProperty?: string
}

interface AssembleResult {
  sourceLabel: string
  briefingTitle: string | null
  parsed: number
  imported: number
  skippedDuplicate: number
  skippedSimilarSubject: number
  skippedInvalid: number
  skippedStale: number
  error?: string
}

interface AssemblyArticle {
  title: string
  summary: string
  url: string
  category: string
  publishedDate?: string | null
  maxAgeDays?: number
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return assemble(request, { dryRun: false })
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error: missing ADMIN_PASSWORD.' }, { status: 500 })
  }

  let body: { adminPassword?: string; dryRun?: boolean; date?: string; maxArticles?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return assemble(request, {
    dryRun: body.dryRun !== false,
    dateOverride: body.date,
    maxArticles: body.maxArticles,
  })
}

async function assemble(
  request: NextRequest,
  opts: { dryRun: boolean; dateOverride?: string; maxArticles?: number },
) {
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID
  const openaiApiKey = process.env.OPENAI_API_KEY
  const notionResearchDbId = process.env.NOTION_RESEARCH_DB_ID
  const sources = parseSourcesEnv(process.env.BRIEFING_SOURCES)

  if (!notionToken || !notionDatabaseId || !openaiApiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: missing Notion or OpenAI environment variables.' },
      { status: 500 },
    )
  }

  if (sources.length === 0) {
    return NextResponse.json({ error: 'BRIEFING_SOURCES is not configured.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const date = opts.dateOverride ?? searchParams.get('date') ?? issueDateFor()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  const dryRun = opts.dryRun
  const maxArticles = Math.max(1, Math.min(opts.maxArticles ?? 50, 75))
  const notion = new Client({ auth: notionToken })
  const openai = new OpenAI({ apiKey: openaiApiKey })
  const [knownUrls, knownTitles] = await Promise.all([
    buildKnownUrlMap(30),
    buildKnownTitleList(30),
  ])
  const seenThisRun = new Set<string>()
  const importedTitlesThisRun: Array<{ title: string }> = []
  const categoryRank = new Map<string, number>()
  CATEGORY_ORDER.forEach((category, index) => categoryRank.set(category, index))

  const sourceResults: AssembleResult[] = []
  let importedTotal = 0
  let parsedTotal = 0

  for (const source of sources) {
    const result: AssembleResult = {
      sourceLabel: source.label,
      briefingTitle: null,
      parsed: 0,
      imported: 0,
      skippedDuplicate: 0,
      skippedSimilarSubject: 0,
      skippedInvalid: 0,
      skippedStale: 0,
    }

    try {
      const briefingPage = source.type === 'database'
        ? await findDatabaseBriefingForDate(notion, source.id, date, source.dateProperty ?? 'Date')
        : await findPageBriefingForDate(notion, source.id, date, source.label)

      if (!briefingPage) {
        sourceResults.push({ ...result, error: 'No briefing found for date.' })
        continue
      }

      result.briefingTitle = briefingPage.title
      const blocks = await fetchAllBlocks(notion, briefingPage.id)
      const briefing = parseBriefingBlocks(blocks)
      let articles: AssemblyArticle[] = briefing.sections.flatMap(section => {
        const category = categorize(source.label, section.name)
        return section.articles.map(article => ({
          title: article.title,
          summary: article.summary,
          url: article.urls[0] ?? '',
          category,
        }))
      }).sort((a, b) => {
        const ar = categoryRank.get(a.category) ?? Number.MAX_SAFE_INTEGER
        const br = categoryRank.get(b.category) ?? Number.MAX_SAFE_INTEGER
        return ar - br
      })

      if (shouldUseAiVoicesFallback(source.label, briefingPage.title) && articles.length < 8) {
        const directArticles = await fetchAiVoicesArticles(date, 12)
        articles = mergeAssemblyArticles([...articles, ...directArticles.map(article => ({
          title: article.title,
          summary: article.summary,
          url: article.url,
          category: article.category,
          publishedDate: article.publishedDate,
          maxAgeDays: article.maxAgeDays,
        }))])
        if (directArticles.length > 0) {
          result.briefingTitle = `${result.briefingTitle} + direct AI voices feed fallback`
        }
      }

      result.parsed = articles.length
      parsedTotal += articles.length

      for (const article of articles) {
        if (importedTotal >= maxArticles) break

        const normalized = normalizeUrl(article.url)
        if (!normalized) {
          result.skippedInvalid++
          continue
        }

        if (knownUrls.has(normalized) || seenThisRun.has(normalized)) {
          result.skippedDuplicate++
          continue
        }

        seenThisRun.add(normalized)

        const meta = await fetchArticleMeta(article.url)
        const resolvedTitle = chooseSourceTitle(article.title?.trim() || article.url, meta.title).title
        const publishedDate = meta.publishedDate ?? article.publishedDate ?? null
        if (!isPublishedDateFreshForIssue(publishedDate, date, article.maxAgeDays)) {
          result.skippedStale++
          continue
        }

        const subjectDuplicate = findSubjectDuplicate(resolvedTitle, knownTitles, importedTitlesThisRun)
        if (subjectDuplicate.duplicate) {
          result.skippedSimilarSubject++
          continue
        }

        if (!dryRun) {
          const annotation = await generateAnnotation(openai, article.url, {
            knownTitle: resolvedTitle,
            fallbackSummary: article.summary,
          })

          const input: CaptureArticleInput = {
            title: resolvedTitle,
            annotation,
            url: article.url,
            publishedDate,
            imageUrl: meta.imageUrl,
            category: article.category,
          }

          await captureArticleToDraftDate(input, date)
        }

        result.imported++
        importedTotal++
        importedTitlesThisRun.push({ title: resolvedTitle })
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : 'Unknown error'
    }

    sourceResults.push(result)
  }

  const researchResult: AssembleResult = {
    sourceLabel: 'AI Research Papers',
    briefingTitle: null,
    parsed: 0,
    imported: 0,
    skippedDuplicate: 0,
    skippedSimilarSubject: 0,
    skippedInvalid: 0,
    skippedStale: 0,
  }

  try {
    const { papers, databaseIdsChecked } = await fetchResearchPapersForDate(notion, notionResearchDbId, date)
    researchResult.briefingTitle = databaseIdsChecked.length > 0
      ? `Checked ${databaseIdsChecked.length} research database${databaseIdsChecked.length === 1 ? '' : 's'}`
      : null
    researchResult.parsed = papers.length
    parsedTotal += papers.length

    for (const paper of papers) {
      if (importedTotal >= maxArticles) break
      if (!paper.url) {
        researchResult.skippedInvalid++
        continue
      }

      const normalized = normalizeUrl(paper.url)
      if (!normalized) {
        researchResult.skippedInvalid++
        continue
      }

      if (knownUrls.has(normalized) || seenThisRun.has(normalized)) {
        researchResult.skippedDuplicate++
        continue
      }

      seenThisRun.add(normalized)

      const subjectDuplicate = findSubjectDuplicate(paper.title, knownTitles, importedTitlesThisRun)
      if (subjectDuplicate.duplicate) {
        researchResult.skippedSimilarSubject++
        continue
      }

      if (!dryRun) {
        const annotation = await generateAnnotation(openai, paper.url, {
          knownTitle: paper.title,
          fallbackSummary: paper.summary ?? paper.keyFindings,
        })

        await captureArticleToDraftDate({
          title: paper.title,
          annotation,
          url: paper.url,
          publishedDate: paper.date,
          imageUrl: null,
          category: 'Research',
        }, date)
      }

      researchResult.imported++
      importedTotal++
      importedTitlesThisRun.push({ title: paper.title })
    }
  } catch (err) {
    researchResult.error = err instanceof Error ? err.message : 'Unknown error'
  }

  sourceResults.push(researchResult)

  if (!dryRun && importedTotal > 0) {
    revalidatePath('/', 'layout')
  }

  return NextResponse.json({
    date,
    dryRun,
    maxArticles,
    parsed: parsedTotal,
    imported: importedTotal,
    sources: sourceResults,
  })
}

function parseSourcesEnv(raw: string | undefined): SourceConfig[] {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.label === 'string')
      .map(s => ({
        id: s.id as string,
        label: s.label as string,
        type: (s.type === 'database' ? 'database' : 'page') as SourceType,
        dateProperty: typeof s.dateProperty === 'string' ? s.dateProperty : undefined,
      }))
  } catch {
    return []
  }
}

function shouldUseAiVoicesFallback(sourceLabel: string, briefingTitle: string | null): boolean {
  const text = `${sourceLabel} ${briefingTitle ?? ''}`.toLowerCase()
  return text.includes('daily news') || text.includes('ai voices') || text.includes('research digest')
}

function mergeAssemblyArticles(articles: AssemblyArticle[]): AssemblyArticle[] {
  const seen = new Set<string>()
  const merged: AssemblyArticle[] = []
  for (const article of articles) {
    const normalized = normalizeUrl(article.url)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    merged.push(article)
  }
  return merged
}

async function findPageBriefingForDate(
  notion: Client,
  parentPageId: string,
  date: string,
  sourceLabel: string,
): Promise<{ id: string; title: string } | null> {
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: parentPageId,
      page_size: 100,
      start_cursor: cursor,
    })
    for (const block of res.results) {
      if ('type' in block && block.type === 'child_page') {
        const title = block.child_page?.title ?? ''
        if (title.includes(date)) return { id: block.id, title }
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)
  return findBriefingBySearch(notion, sourceLabel, date)
}

async function findBriefingBySearch(
  notion: Client,
  sourceLabel: string,
  date: string,
): Promise<{ id: string; title: string } | null> {
  const searchQueries = [sourceLabel, date]
  const candidates: { id: string; title: string; score: number }[] = []

  for (const query of searchQueries) {
    const res = await notion.search({
      query,
      page_size: 25,
      filter: { property: 'object', value: 'page' },
    })

    for (const item of res.results) {
      if (item.object !== 'page' || !('properties' in item)) continue
      const title = pageTitle(item)
      if (!title.includes(date) || /^AI Today/i.test(title)) continue

      const sourceWords = sourceLabel.toLowerCase().split(/\s+/).filter(word => word.length > 2)
      const titleLower = title.toLowerCase()
      const wordScore = sourceWords.filter(word => titleLower.includes(word)).length
      const canadaBonus = sourceLabel.toLowerCase().includes('canada') && titleLower.includes('canada') ? 3 : 0
      const dailyBonus = titleLower.includes('daily') ? 1 : 0
      candidates.push({ id: item.id, title, score: wordScore + canadaBonus + dailyBonus })
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return candidates[0] ? { id: candidates[0].id, title: candidates[0].title } : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageTitle(page: any): string {
  const props = page.properties ?? {}
  for (const key of Object.keys(props)) {
    const prop = props[key]
    if (prop?.type === 'title' && Array.isArray(prop.title)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return prop.title.map((text: any) => text.plain_text ?? '').join('').trim()
    }
  }
  return ''
}

async function findDatabaseBriefingForDate(
  notion: Client,
  databaseId: string,
  date: string,
  dateProperty: string,
): Promise<{ id: string; title: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: dateProperty,
      date: { equals: date },
    },
    page_size: 5,
  })
  const row = res.results?.[0]
  if (!row || !row.id) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = row.properties ?? {}
  let title = ''
  for (const key of Object.keys(props)) {
    const prop = props[key]
    if (prop?.type === 'title' && Array.isArray(prop.title) && prop.title.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      title = prop.title.map((text: any) => text.plain_text ?? '').join('')
      break
    }
  }
  return { id: row.id, title: title || `(row ${date})` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllBlocks(notion: Client, blockId: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    })
    all.push(...res.results)
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)
  return all
}
