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
  pageId: string
  sections: SectionsInput
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

// ─── URL parsing ────────────────────────────────────────────────────────────────

function parseUrls(input: string): string[] {
  if (!input || !input.trim()) return []
  return input
    .split(/[\s\n]+/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http'))
}

// ─── Article fetching ───────────────────────────────────────────────────────────

async function fetchArticleText(
  url: string,
  onPdf?: () => void
): Promise<string | null> {
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

async function summariseUrlWithEvents(
  openai: OpenAI,
  url: string,
  section: string,
  emit: (data: string) => void
): Promise<SectionSummary> {
  emit(JSON.stringify({ type: 'fetch', section, url }))

  const articleText = await fetchArticleText(url, () => {
    emit(JSON.stringify({ type: 'pdf', section, url }))
  })

  if (!articleText) {
    const summary = `[Could not fetch article. Add summary manually.] Source: ${url}`
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, summary }
  }

  emit(JSON.stringify({ type: 'summarise', section, url }))

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
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, summary }
  } catch {
    const summary = `[AI summary failed. Add manually.] Source: ${url}`
    emit(JSON.stringify({ type: 'done_url', section, url, summary }))
    return { url, summary }
  }
}

// ─── Section heading labels ─────────────────────────────────────────────────────

const SECTION_HEADINGS: Record<keyof SectionsInput, string> = {
  top: 'Top Stories',
  bright: '🌟 Bright Spot of the Week',
  tool: '🔧 Tool of the Week',
  learning: '💡 Learning',
  deep: '📖 Deep Dive',
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !notionToken || !openaiApiKey) {
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

  if (!body.pageId || typeof body.pageId !== 'string') {
    return NextResponse.json({ error: 'pageId is required.' }, { status: 400 })
  }

  const { sections, pageId } = body
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: string) {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        const notion = new Client({ auth: notionToken })
        const openai = new OpenAI({ apiKey: openaiApiKey })

        const sectionKeys = Object.keys(sections) as Array<keyof SectionsInput>
        const urlMap: Record<keyof SectionsInput, string[]> = {
          top: parseUrls(sections.top),
          bright: parseUrls(sections.bright),
          tool: parseUrls(sections.tool),
          learning: parseUrls(sections.learning),
          deep: parseUrls(sections.deep),
        }

        const summaryMap: Record<keyof SectionsInput, SectionSummary[]> = {
          top: [],
          bright: [],
          tool: [],
          learning: [],
          deep: [],
        }

        for (const key of sectionKeys) {
          const urls = urlMap[key]
          for (const url of urls) {
            if (request.signal.aborted) { controller.close(); return }
            const result = await summariseUrlWithEvents(openai, url, SECTION_HEADINGS[key], emit)
            summaryMap[key].push(result)
          }
        }

        if (request.signal.aborted) { controller.close(); return }

        // Build blocks to append — only for sections that have URLs
        const blocksToAppend: ReturnType<typeof block.h2 | typeof block.paragraph | typeof block.bookmark | typeof block.divider>[] = []

        for (const key of sectionKeys) {
          const summaries = summaryMap[key]
          if (summaries.length === 0) continue

          blocksToAppend.push(block.h2(SECTION_HEADINGS[key]))

          for (const { url, summary } of summaries) {
            blocksToAppend.push(block.paragraph(summary))
            blocksToAppend.push(block.bookmark(url))
          }

          blocksToAppend.push(block.divider())
        }

        if (blocksToAppend.length === 0) {
          emit(JSON.stringify({ type: 'error', message: 'No URLs provided in any section.' }))
          controller.close()
          return
        }

        emit(JSON.stringify({ type: 'notion', message: 'Appending to Notion page…' }))

        if (request.signal.aborted) { controller.close(); return }

        // Append in batches of 100 (Notion API limit)
        const BATCH_SIZE = 100
        for (let i = 0; i < blocksToAppend.length; i += BATCH_SIZE) {
          const batch = blocksToAppend.slice(i, i + BATCH_SIZE)
          await notion.blocks.children.append({
            block_id: pageId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            children: batch as any,
          })
        }

        const notionUrl = `https://notion.so/${pageId.replace(/-/g, '')}`

        emit(
          JSON.stringify({
            type: 'complete',
            notionUrl,
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
