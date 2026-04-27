import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { generateAnnotation } from '@/lib/ai-annotation'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  adminPassword?: string
  /** URL of the article — used to fetch fresh content for the rewrite. */
  url?: string
  /** Pre-known title; passed through to the prompt for context. */
  knownTitle?: string | null
  /** Notion paragraph block ID — only required when apply: true. */
  blockId?: string
  /** When true, write `annotation` (or the freshly-generated one) to the
   *  paragraph block at `blockId`. When false (default), just return the
   *  generated annotation for client-side preview. */
  apply?: boolean
  /** Annotation text to apply. If omitted in apply mode, the endpoint
   *  generates a fresh one and applies that. */
  annotation?: string
}

// ─── Route handler ──────────────────────────────────────────────────────────────

/**
 * Two-mode endpoint for the per-article regenerate flow on TodaysDraft:
 *   - apply: false (default) — generate a new annotation, return it for
 *            side-by-side preview. No DB write.
 *   - apply: true             — replace the paragraph block at `blockId`
 *            with `annotation` (or a freshly-generated one). Returns the
 *            written text for confirmation.
 *
 * Voice consistency comes from generateAnnotation() → SYSTEM_PROMPTS.brief.
 */
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

  const apply = body.apply === true
  if (apply && !body.blockId) {
    return NextResponse.json({ error: 'blockId is required when apply: true.' }, { status: 400 })
  }

  const openai = new OpenAI({ apiKey: openaiApiKey })

  try {
    // If apply mode AND the client already has an annotation it picked,
    // skip the regenerate call — just write what they chose. Otherwise,
    // generate fresh.
    let annotation = body.annotation?.trim() ?? ''
    if (!annotation) {
      annotation = await generateAnnotation(openai, url, { knownTitle: body.knownTitle ?? null })
    }

    if (!apply) {
      return NextResponse.json({ annotation })
    }

    // Apply mode — replace the paragraph block in place
    const notion = new Client({ auth: notionToken })
    await notion.blocks.update({
      block_id: body.blockId!,
      paragraph: {
        rich_text: [{ type: 'text', text: { content: annotation } }],
      },
    })

    return NextResponse.json({ ok: true, annotation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
