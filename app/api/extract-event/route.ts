import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { fetchArticle } from '@/lib/article-fetcher'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  adminPassword?: string
  url?: string
}

export interface ExtractedEvent {
  title: string
  when: string
  where: string
  description: string
}

// ─── Prompt ──────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You extract event details from webpage content and return JSON.

Given the text of an event registration or announcement page, extract:
- title: the event name (short, no surrounding punctuation)
- when: the date and time as plain readable text (e.g. "May 7, 2pm ET", "Wednesday June 4, 7–8:30pm ET", "June 10–12, 2025"). Include timezone if mentioned.
- where: the location or format (e.g. "Virtual", "Toronto, ON", "Hybrid — Ottawa", "In-person"). Keep it short.
- description: 1–2 sentences describing what the event is about and who it is for.

Always return valid JSON with exactly these four keys: title, when, where, description.
If a field cannot be determined, return an empty string for that key.`

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !notionToken || !openaiApiKey) {
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

  const url = body.url?.trim()
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid URL is required.' }, { status: 400 })
  }

  // Fetch the page content — falls back to Jina Reader for bot-protected pages
  const { text, title: fetchedTitle } = await fetchArticle(url)

  if (!text) {
    return NextResponse.json(
      { error: 'Could not read the page at that URL. Try pasting the event details manually.' },
      { status: 422 },
    )
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `URL: ${url}\n` +
            (fetchedTitle ? `Page title: ${fetchedTitle}\n` : '') +
            `\nPage content:\n${text.slice(0, 4000)}`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
    const extracted = JSON.parse(raw) as Partial<ExtractedEvent>

    const result: ExtractedEvent = {
      title: (extracted.title ?? fetchedTitle ?? '').trim(),
      when: (extracted.when ?? '').trim(),
      where: (extracted.where ?? '').trim(),
      description: (extracted.description ?? '').trim(),
    }

    return NextResponse.json({ success: true, event: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 })
  }
}
