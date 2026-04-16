import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { createRequire } from 'module'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SectionSummary {
  url: string
  summary: string
}

interface SectionsInput {
  top: string
  bright: string
  tool: string
  learning: string
  deep: string
}

interface RequestBody {
  password: string
  sections: SectionsInput
}

interface ApiResponse {
  notionUrl: string
  issueNumber: number
  summaries: {
    top: SectionSummary[]
    bright: SectionSummary[]
    tool: SectionSummary[]
    learning: SectionSummary[]
    deep: SectionSummary[]
  }
}

// ─── Notion block helpers ───────────────────────────────────────────────────────

function richText(content: string) {
  return [{ type: 'text' as const, text: { content } }]
}

const block = {
  h2: (content: string) => ({
    object: 'block' as const,
    type: 'heading_2' as const,
    heading_2: { rich_text: richText(content) },
  }),
  paragraph: (content: string) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: { rich_text: richText(content) },
  }),
  bullet: (content: string) => ({
    object: 'block' as const,
    type: 'bulleted_list_item' as const,
    bulleted_list_item: { rich_text: richText(content) },
  }),
  divider: () => ({
    object: 'block' as const,
    type: 'divider' as const,
    divider: {},
  }),
  bookmark: (url: string) => ({
    object: 'block' as const,
    type: 'bookmark' as const,
    bookmark: { url, caption: [] as never[] },
  }),
}

// ─── Date helpers ───────────────────────────────────────────────────────────────

function nextMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntil)
  return monday.toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Notion helpers ─────────────────────────────────────────────────────────────

async function getNextIssueNumber(notion: Client, databaseId: string): Promise<number> {
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
  return input
    .split(/[\s\n]+/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http'))
}

// ─── Article fetching ───────────────────────────────────────────────────────────

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    const isPdf =
      contentType.includes('application/pdf') ||
      url.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      const buffer = Buffer.from(await res.arrayBuffer())
      try {
        // pdf-parse is CommonJS — use createRequire to load it in ESM/TS context
        const require = createRequire(import.meta.url)
        const { PDFParse } = require('pdf-parse')
        const parser = new PDFParse({ data: buffer, verbosity: 0 })
        const result = await parser.getText({ maxPages: 5 })
        return (result.text as string).replace(/\s{2,}/g, ' ').trim().slice(0, 6000)
      } catch {
        return null
      }
    }

    const html = await res.text()
    const mainMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const source = mainMatch ? mainMatch[1] : html

    const stripped = source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    return stripped.slice(0, 6000)
  } catch {
    return null
  }
}

// ─── OpenAI summarisation ───────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'You write concise, clear 2-3 sentence summaries for an AI newsletter aimed at a professional, non-technical audience. Your tone is informative and neutral — like a quality broadsheet news brief, not hype-driven tech journalism. Rules: 2-3 sentences maximum, no bullet points. Lead with what happened and why it matters. Avoid jargon; if a technical term is essential, briefly explain it. No "In this article..." or "The author argues..." framing. Do not invent facts not present in the article text. End with a period.'

async function summariseUrl(
  openai: OpenAI,
  url: string
): Promise<SectionSummary> {
  const articleText = await fetchArticleText(url)

  if (!articleText) {
    return {
      url,
      summary: `[Could not fetch article. Add summary manually.] Source: ${url}`,
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Please summarise this article in 2-3 sentences:\n\nURL: ${url}\n\n---\n\n${articleText}`,
        },
      ],
    })
    const summary =
      response.choices[0]?.message?.content?.trim() ??
      '[Summary unavailable — review and edit before publishing.]'
    return { url, summary }
  } catch {
    return {
      url,
      summary: `[AI summary failed. Add manually.] Source: ${url}`,
    }
  }
}

async function summariseUrls(
  openai: OpenAI,
  urls: string[]
): Promise<SectionSummary[]> {
  const results: SectionSummary[] = []
  for (const url of urls) {
    results.push(await summariseUrl(openai, url))
  }
  return results
}

// ─── Notion block builders ──────────────────────────────────────────────────────

function topStoriesBlocks(summaries: SectionSummary[]) {
  if (summaries.length === 0) {
    return [
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
    ]
  }

  const blocks = []
  for (const { url, summary } of summaries) {
    blocks.push(block.paragraph(`🔹 ${summary}`))
    blocks.push(block.bookmark(url))
  }

  const remaining = Math.max(0, 3 - summaries.length)
  for (let i = 0; i < remaining; i++) {
    blocks.push(
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]')
    )
  }

  return blocks
}

function singleSectionBlocks(summaries: SectionSummary[], placeholder: string) {
  if (summaries.length === 0) {
    return [block.paragraph(placeholder)]
  }
  const { url, summary } = summaries[0]
  return [block.paragraph(summary), block.bookmark(url)]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    const notionToken = process.env.NOTION_TOKEN
    const notionDatabaseId = process.env.NOTION_DATABASE_ID
    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!adminPassword || !notionToken || !notionDatabaseId || !openaiApiKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing environment variables.' },
        { status: 500 }
      )
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

    const { sections } = body

    const notion = new Client({ auth: notionToken })
    const openai = new OpenAI({ apiKey: openaiApiKey })

    const issueDate = nextMonday()
    const issueNumber = await getNextIssueNumber(notion, notionDatabaseId)
    const title = `AI This Week — ${formatDate(issueDate)}`

    // Summarise each non-empty section
    const topUrls = parseUrls(sections.top)
    const brightUrls = parseUrls(sections.bright)
    const toolUrls = parseUrls(sections.tool)
    const learningUrls = parseUrls(sections.learning)
    const deepUrls = parseUrls(sections.deep)

    const [topSummaries, brightSummaries, toolSummaries, learnSummaries, deepSummaries] =
      await Promise.all([
        topUrls.length > 0 ? summariseUrls(openai, topUrls) : Promise.resolve([]),
        brightUrls.length > 0 ? summariseUrls(openai, brightUrls) : Promise.resolve([]),
        toolUrls.length > 0 ? summariseUrls(openai, toolUrls) : Promise.resolve([]),
        learningUrls.length > 0 ? summariseUrls(openai, learningUrls) : Promise.resolve([]),
        deepUrls.length > 0 ? summariseUrls(openai, deepUrls) : Promise.resolve([]),
      ])

    // Create Notion page
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
        block.paragraph("Hello,\n\nHere's your weekly update on the latest in AI."),
        block.divider(),

        block.h2('Top Stories'),
        block.paragraph('⚠️ AI-generated summaries below — review and edit each one before publishing.'),
        ...topStoriesBlocks(topSummaries),
        block.divider(),

        block.h2('🌟 Bright Spot of the Week'),
        ...singleSectionBlocks(
          brightSummaries,
          '[AI-generated summary. Review for accuracy and edit before publishing.]'
        ),
        block.divider(),

        block.h2('🔧 Tool of the Week'),
        ...singleSectionBlocks(
          toolSummaries,
          '[AI-generated summary. Review for accuracy and edit before publishing.]'
        ),
        block.divider(),

        block.h2('💡 Learning'),
        ...singleSectionBlocks(
          learnSummaries,
          '[AI-generated summary. Review for accuracy and edit before publishing.]'
        ),
        block.divider(),

        block.h2('📖 Deep Dive'),
        ...singleSectionBlocks(
          deepSummaries,
          '[AI-generated summary. Review for accuracy and edit before publishing.]'
        ),
      ],
    })

    const notionUrl =
      'url' in page && typeof page.url === 'string' ? page.url : ''

    const result: ApiResponse = {
      notionUrl,
      issueNumber,
      summaries: {
        top: topSummaries,
        bright: brightSummaries,
        tool: toolSummaries,
        learning: learnSummaries,
        deep: deepSummaries,
      },
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
