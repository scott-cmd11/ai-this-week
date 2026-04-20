import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { createRequire } from 'module'

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
  learning: string
  deep: string
}

type SummaryLength = 'brief' | 'standard' | 'detailed'

interface RequestBody {
  password: string
  sections: SectionsInput
  includeImages?: boolean
  summaryLength?: SummaryLength
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
  linkedTitle: (title: string, url: string) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: {
      rich_text: [{
        type: 'text' as const,
        text: { content: title, link: { url } },
        annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: 'default' as const },
      }],
    },
  }),
  image: (imageUrl: string) => ({
    object: 'block' as const,
    type: 'image' as const,
    image: { type: 'external' as const, external: { url: imageUrl } },
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

interface FetchResult {
  text: string | null
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]?.startsWith('http')) return match[1]
  }
  return null
}

function extractPublishedDate(html: string): string | null {
  // Try meta tags in order of reliability
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']date["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const date = new Date(match[1])
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      }
    }
  }

  // Try JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const content = block.replace(/<script[^>]*>|<\/script>/gi, '')
        const data = JSON.parse(content)
        const entries = Array.isArray(data) ? data : [data]
        for (const entry of entries) {
          const raw = entry?.datePublished ?? entry?.dateCreated
          if (raw) {
            const date = new Date(raw)
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
            }
          }
        }
      } catch { /* skip malformed JSON-LD */ }
    }
  }

  return null
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (!match) return null
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    // Strip common site-name suffixes like " | TechCrunch" or " - The Verge"
    .replace(/\s*[\|\-–—]\s*[^|\-–—]{2,40}$/, '')
    .trim() || null
}

// Jina Reader fallback — handles Cloudflare-protected and JS-heavy sites.
// Free, no API key needed. Returns clean article text.
async function fetchViaJina(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { text: null, title: null, publishedDate: null, imageUrl: null }
    const raw = await res.text()
    const titleMatch = raw.match(/^Title:\s*(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? null
    const text = raw.replace(/^(Title|URL Source|Published Time):.*$/gm, '').trim().slice(0, 6000)
    return { text: text || null, title, publishedDate: null, imageUrl: null }
  } catch {
    return { text: null, title: null, publishedDate: null, imageUrl: null }
  }
}

async function fetchArticle(
  url: string,
  onPdf?: () => void
): Promise<FetchResult> {
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
      onPdf?.()
      const buffer = Buffer.from(await res.arrayBuffer())
      try {
        const require = createRequire(import.meta.url)
        const { PDFParse } = require('pdf-parse')
        const parser = new PDFParse({ data: buffer, verbosity: 0 })
        const result = await parser.getText({ maxPages: 5 })
        const text = (result.text as string).replace(/\s{2,}/g, ' ').trim().slice(0, 6000)
        // Use hostname as title for PDFs since there's no <title> tag
        return { text, title: new URL(url).hostname.replace('www.', ''), publishedDate: null, imageUrl: null }
      } catch {
        return { text: null, title: null, publishedDate: null, imageUrl: null }
      }
    }

    const html = await res.text()
    const title = extractTitle(html)
    const publishedDate = extractPublishedDate(html)
    const imageUrl = extractOgImage(html)

    const mainMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const source = mainMatch ? mainMatch[1] : html

    const text = source
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
      .slice(0, 6000)

    // If text is suspiciously short it's likely a bot-challenge page — fall back to Jina
    if (text.length < 200) throw new Error('Content too short — likely bot challenge')

    return { text, title, publishedDate, imageUrl }
  } catch {
    // Fallback: Jina Reader handles Cloudflare-protected and JS-rendered pages
    return fetchViaJina(url)
  }
}

// ─── OpenAI summarisation ───────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<SummaryLength, string> = {
  brief:
    'You write concise 1-2 sentence summaries for an AI newsletter aimed at a professional, non-technical audience. Your tone is informative and neutral — like a quality broadsheet news brief. Rules: 1-2 sentences maximum, no bullet points. Lead with what happened and why it matters. Avoid jargon. No "In this article..." framing. Do not invent facts not present in the article text. End with a period.',
  standard:
    'You write concise, clear 2-3 sentence summaries for an AI newsletter aimed at a professional, non-technical audience. Your tone is informative and neutral — like a quality broadsheet news brief, not hype-driven tech journalism. Rules: 2-3 sentences maximum, no bullet points. Lead with what happened and why it matters. Avoid jargon; if a technical term is essential, briefly explain it. No "In this article..." or "The author argues..." framing. Do not invent facts not present in the article text. End with a period.',
  detailed:
    'You write clear, informative 3-4 sentence summaries for an AI newsletter aimed at a professional, non-technical audience. Your tone is informative and neutral — like a quality broadsheet news brief, not hype-driven tech journalism. Rules: 3-4 sentences. No bullet points. Lead with what happened, explain the significance, and add a sentence of context or implication. Avoid jargon; if a technical term is essential, briefly explain it. No "In this article..." or "The author argues..." framing. Do not invent facts not present in the article text. End with a period.',
}

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
        {
          role: 'user',
          content: `Please summarise this article:\n\nURL: ${url}\n\n---\n\n${articleText}`,
        },
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
    if (title) blocks.push(block.linkedTitle(title, url))
    if (publishedDate) blocks.push(block.paragraph(`Published: ${publishedDate}`))
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

function singleSectionBlocks(summaries: SectionSummary[], placeholder: string, includeImages: boolean) {
  if (summaries.length === 0) {
    return [block.paragraph(placeholder)]
  }
  const { url, title, publishedDate, imageUrl, summary } = summaries[0]
  return [
    ...(includeImages && imageUrl ? [block.image(imageUrl)] : []),
    ...(title ? [block.linkedTitle(title, url)] : []),
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

        const issueDate = nextMonday()
        const issueNumber = await getNextIssueNumber(notion, notionDatabaseId)
        const title = `AI This Week — ${formatDate(issueDate)}`

        const topUrls = parseUrls(sections.top)
        const brightUrls = parseUrls(sections.bright)
        const toolUrls = parseUrls(sections.tool)
        const learningUrls = parseUrls(sections.learning)
        const deepUrls = parseUrls(sections.deep)

        const allSections: Array<{ key: string; label: string; urls: string[] }> = [
          { key: 'top', label: 'Top Stories', urls: topUrls },
          { key: 'bright', label: 'Bright Spot', urls: brightUrls },
          { key: 'tool', label: 'Tool of the Week', urls: toolUrls },
          { key: 'learning', label: 'Learning', urls: learningUrls },
          { key: 'deep', label: 'Deep Dive', urls: deepUrls },
        ]

        const summaryMap: Record<string, SectionSummary[]> = {
          top: [],
          bright: [],
          tool: [],
          learning: [],
          deep: [],
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
            block.paragraph("Hello,\n\nHere's your weekly update on the latest in AI."),
            block.divider(),

            block.h2('Top Stories'),
            block.paragraph('⚠️ AI-generated summaries below — review and edit each one before publishing.'),
            ...topStoriesBlocks(summaryMap.top, includeImages),
            block.divider(),

            block.h2('🌟 Bright Spot of the Week'),
            ...singleSectionBlocks(
              summaryMap.bright,
              '[AI-generated summary. Review for accuracy and edit before publishing.]',
              includeImages
            ),
            block.divider(),

            block.h2('🔧 Tool of the Week'),
            ...singleSectionBlocks(
              summaryMap.tool,
              '[AI-generated summary. Review for accuracy and edit before publishing.]',
              includeImages
            ),
            block.divider(),

            block.h2('💡 Learning'),
            ...singleSectionBlocks(
              summaryMap.learning,
              '[AI-generated summary. Review for accuracy and edit before publishing.]',
              includeImages
            ),
            block.divider(),

            block.h2('📖 Deep Dive'),
            ...singleSectionBlocks(
              summaryMap.deep,
              '[AI-generated summary. Review for accuracy and edit before publishing.]',
              includeImages
            ),
          ],
        })

        const notionUrl =
          'url' in page && typeof page.url === 'string' ? page.url : ''

        emit(
          JSON.stringify({
            type: 'complete',
            notionUrl,
            issueNumber,
            summaries: summaryMap,
          })
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        emit(JSON.stringify({ type: 'error', message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
