import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { SYSTEM_PROMPTS, type SummaryLength } from '@/lib/prompts'
import { fetchArticle, hostnameFallback } from '@/lib/article-fetcher'
import { block, richText, formatIsoDate } from '@/lib/notion-blocks'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SectionSummary {
  url: string
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
  summary: string
}

interface SectionsInput {
  top: string
  bright: string
  tool: string
  podcast: string
  learning: string
  deep: string
}

interface RequestBody {
  password: string
  sections: SectionsInput
  includeImages?: boolean
  summaryLength?: SummaryLength
}

// ─── Date helpers ───────────────────────────────────────────────────────────────

function nextFriday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntil = day === 5 ? 7 : day < 5 ? 5 - day : 6
  const friday = new Date(today)
  friday.setDate(today.getDate() + daysUntil)
  return friday.toISOString().split('T')[0]
}

// ─── Notion helpers ─────────────────────────────────────────────────────────────

export async function getNextIssueNumber(notion: Client, databaseId: string): Promise<number> {
  const response = await notion.databases.query({
    database_id: databaseId,
    sorts: [{ property: 'Issue Number', direction: 'descending' }],
    page_size: 1,
  })
  if (response.results.length === 0) return 1
  const page = response.results[0]
  if (page.object !== 'page' || !('properties' in page)) return 1
  const prop = page.properties['Issue Number']
  if (prop?.type !== 'number') return 1
  return (prop.number ?? 0) + 1
}

// ─── URL parsing ────────────────────────────────────────────────────────────────

function parseUrls(input: string): string[] {
  if (!input || !input.trim()) return []
  return input.split(/[\s\n]+/).map(u => u.trim()).filter(u => u.startsWith('http'))
}

// ─── OpenAI summarisation ───────────────────────────────────────────────────────

async function summariseUrlWithEvents(
  openai: OpenAI,
  url: string,
  section: string,
  summaryLength: SummaryLength,
  emit: (data: string) => void
): Promise<SectionSummary> {
  emit(JSON.stringify({ type: 'fetch', section, url }))

  const { text: articleText, title, publishedDate, imageUrl } = await fetchArticle(url, () => {
    emit(JSON.stringify({ type: 'pdf', section, url }))
  })

  if (!articleText) {
    const summary = `[Could not fetch article. Add summary manually.]`
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, title, publishedDate, imageUrl, summary }
  }

  emit(JSON.stringify({ type: 'summarise', section, url }))

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[summaryLength] ?? SYSTEM_PROMPTS.standard },
        { role: 'user', content: `Please summarise this article:\n\nURL: ${url}\n\n---\n\n${articleText}` },
      ],
    })
    const summary =
      response.choices[0]?.message?.content?.trim() ??
      '[Summary unavailable — review and edit before publishing.]'
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, title, publishedDate, imageUrl, summary }
  } catch {
    const summary = `[AI summary failed. Add manually.]`
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, title, publishedDate, imageUrl, summary }
  }
}

// ─── Notion block builders ──────────────────────────────────────────────────────

function topStoriesBlocks(summaries: SectionSummary[], includeImages: boolean) {
  if (summaries.length === 0) {
    return [
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
    ]
  }

  const blocks = []
  for (const { url, title, publishedDate, imageUrl, summary } of summaries) {
    if (includeImages && imageUrl) blocks.push(block.image(imageUrl))
    blocks.push(block.h3(title || hostnameFallback(url)))
    if (publishedDate) blocks.push(block.paragraph(`Published: ${publishedDate}`))
    blocks.push(block.paragraph(`🔹 ${summary}`))
    blocks.push(block.bookmark(url))
  }

  const remaining = Math.max(0, 3 - summaries.length)
  for (let i = 0; i < remaining; i++) {
    blocks.push(block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'))
  }

  return blocks
}

function singleSectionBlocks(summaries: SectionSummary[], placeholder: string, includeImages: boolean) {
  if (summaries.length === 0) return [block.paragraph(placeholder)]
  const { url, title, publishedDate, imageUrl, summary } = summaries[0]
  return [
    ...(includeImages && imageUrl ? [block.image(imageUrl)] : []),
    block.h3(title || hostnameFallback(url)),
    ...(publishedDate ? [block.paragraph(`Published: ${publishedDate}`)] : []),
    block.paragraph(summary),
    block.bookmark(url),
  ]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !notionToken || !notionDatabaseId || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error: missing environment variables.' }, { status: 500 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const { sections, includeImages = false, summaryLength = 'standard' } = body
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        const notion = new Client({ auth: notionToken })
        const openai = new OpenAI({ apiKey: openaiApiKey })

        const issueDate = nextFriday()
        const issueNumber = await getNextIssueNumber(notion, notionDatabaseId)
        const title = `AI Today — ${formatIsoDate(issueDate)}`

        const topUrls = parseUrls(sections.top)
        const brightUrls = parseUrls(sections.bright)
        const toolUrls = parseUrls(sections.tool)
        const podcastUrls = parseUrls(sections.podcast)
        const learningUrls = parseUrls(sections.learning)
        const deepUrls = parseUrls(sections.deep)

        const allSections: Array<{ key: string; label: string; urls: string[] }> = [
          { key: 'top', label: 'Top Stories', urls: topUrls },
          { key: 'bright', label: 'Bright Spot', urls: brightUrls },
          { key: 'tool', label: 'Tool of the Week', urls: toolUrls },
          { key: 'podcast', label: 'Podcast of the Week', urls: podcastUrls },
          { key: 'learning', label: 'Learning', urls: learningUrls },
          { key: 'deep', label: 'Deep Dive', urls: deepUrls },
        ]

        const summaryMap: Record<string, SectionSummary[]> = {
          top: [], bright: [], tool: [], podcast: [], learning: [], deep: [],
        }

        const totalUrls = allSections.reduce((n, s) => n + s.urls.length, 0)
        if (totalUrls === 0) {
          emit(JSON.stringify({ type: 'error', message: 'No URLs provided in any section.' }))
          controller.close()
          return
        }

        for (const { key, label, urls } of allSections) {
          if (request.signal.aborted) { controller.close(); return }
          for (const url of urls) {
            if (request.signal.aborted) { controller.close(); return }
            const result = await summariseUrlWithEvents(openai, url, label, summaryLength, emit)
            summaryMap[key].push(result)
          }
        }

        if (request.signal.aborted) { controller.close(); return }

        emit(JSON.stringify({ type: 'notion', message: 'Creating Notion page…' }))

        const page = await notion.pages.create({
          parent: { database_id: notionDatabaseId },
          properties: {
            Title: { title: richText(title) },
            'Issue Date': { date: { start: issueDate } },
            'Issue Number': { number: issueNumber },
            Published: { checkbox: false },
            'AI Assisted': { checkbox: true },
          },
          children: [
            block.h2('Top Stories'),
            block.paragraph('⚠️ AI-generated summaries below — review and edit each one before publishing.'),
            ...topStoriesBlocks(summaryMap.top, includeImages),
            block.divider(),
            block.h2('🌟 Bright Spot of the Week'),
            ...singleSectionBlocks(summaryMap.bright, '[AI-generated summary. Review for accuracy and edit before publishing.]', includeImages),
            block.divider(),
            block.h2('🔧 Tool of the Week'),
            ...singleSectionBlocks(summaryMap.tool, '[AI-generated summary. Review for accuracy and edit before publishing.]', includeImages),
            block.divider(),
            block.h2('🎙️ Podcast of the Week'),
            ...singleSectionBlocks(summaryMap.podcast, '[AI-generated summary. Review for accuracy and edit before publishing.]', includeImages),
            block.divider(),
            block.h2('💡 Learning'),
            ...singleSectionBlocks(summaryMap.learning, '[AI-generated summary. Review for accuracy and edit before publishing.]', includeImages),
            block.divider(),
            block.h2('📖 Deep Dive'),
            ...singleSectionBlocks(summaryMap.deep, '[AI-generated summary. Review for accuracy and edit before publishing.]', includeImages),
          ],
        })

        const notionUrl = 'url' in page && typeof page.url === 'string' ? page.url : ''
        emit(JSON.stringify({ type: 'complete', notionUrl, issueNumber, summaries: summaryMap }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        emit(JSON.stringify({ type: 'error', message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
