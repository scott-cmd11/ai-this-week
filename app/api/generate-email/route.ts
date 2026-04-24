import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

type SectionKey = 'top' | 'bright' | 'tool' | 'podcast' | 'learning' | 'deep'

interface SectionSummary {
  url: string
  title: string | null
  summary: string
  publishedDate?: string | null
  imageUrl?: string | null
}

const SECTION_KEYS: SectionKey[] = ['top', 'bright', 'tool', 'podcast', 'learning', 'deep']

const SECTION_LABELS: Record<SectionKey, string> = {
  top: 'Top Stories',
  bright: 'Bright Spot of the Week',
  tool: 'Tool of the Week',
  podcast: 'Podcast of the Week',
  learning: 'Learning',
  deep: 'Deep Dive',
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: {
    password: string
    summaries: Record<SectionKey, SectionSummary[]>
    issueNumber: number
    issueUrl?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const summaryLines: string[] = []
  for (const key of SECTION_KEYS) {
    const items = body.summaries[key] ?? []
    if (items.length === 0) continue
    summaryLines.push(`## ${SECTION_LABELS[key]}`)
    for (const { title, summary } of items) {
      if (title) summaryLines.push(`**${title}**`)
      summaryLines.push(summary)
      summaryLines.push('')
    }
  }
  const summaryContent = summaryLines.join('\n').trim()
  const issueUrlLine = body.issueUrl ? `\nIssue URL: ${body.issueUrl}` : ''

  const prompt = `You are writing a short weekly email to subscribers of "AI This Week", a curated AI newsletter.

Here are the summaries from Issue #${body.issueNumber}:${issueUrlLine}

${summaryContent}

Write a short outreach email with:
1. A subject line on its own line in the format: Subject: ...
2. A friendly 1-sentence opening referencing this week's issue number
3. 3-5 highlight bullet points — pick the most interesting items across all sections, one sentence each, punchy and specific, mentioning actual titles or tool names
4. A single call-to-action line (use the URL if provided, otherwise write "[issue link]")
5. A brief sign-off (e.g. "— Scott")

Keep the whole email under 200 words. Plain text only, no HTML or markdown formatting in the body.`

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.choices[0]?.message?.content?.trim() ?? ''
    const subjectMatch = text.match(/^Subject:\s*(.+)$/m)
    const subject = subjectMatch?.[1]?.trim() ?? `AI This Week — Issue #${body.issueNumber}`
    const emailBody = text.replace(/^Subject:.*$/m, '').trim()
    return NextResponse.json({ subject, body: emailBody })
  } catch {
    return NextResponse.json({ error: 'Failed to generate email.' }, { status: 500 })
  }
}
