import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { parseBriefingBlocks, type ParsedBriefing } from '@/lib/briefing-parser'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SourceConfig {
  id: string       // Notion page ID (parent page containing dated child briefings)
  label: string    // Human-readable label shown in admin UI
}

interface SourceResult {
  sourceLabel: string
  sourceId: string
  briefingPageId: string | null
  briefingTitle: string | null
  briefing: ParsedBriefing | null
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function parseSourcesEnv(raw: string | undefined): SourceConfig[] {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(s => s && typeof s === 'object' && typeof s.id === 'string' && typeof s.label === 'string')
      .map(s => ({ id: s.id as string, label: s.label as string }))
  } catch {
    return []
  }
}

/**
 * List all child_page blocks under a parent page and find the one whose title
 * contains the given date string (YYYY-MM-DD).
 *
 * Briefing pages are named like "AI Adoption in Canada — Daily Briefing (2026-04-25)"
 * — we just look for the date substring anywhere in the title.
 */
async function findBriefingForDate(
  notion: Client,
  parentPageId: string,
  date: string,
): Promise<{ id: string; title: string } | null> {
  // Page through children — briefings can accumulate over time
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
  return null
}

/**
 * Fetch all top-level blocks of a page (paginated).
 */
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

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const briefingSourcesRaw = process.env.BRIEFING_SOURCES

  if (!adminPassword || !notionToken) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  // Default date to today (UTC) — same convention as /api/capture and cron
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const sources = parseSourcesEnv(briefingSourcesRaw)
  if (sources.length === 0) {
    return NextResponse.json({ date, sources: [], configured: false })
  }

  const notion = new Client({ auth: notionToken })

  // Process sources in parallel for snappier admin UX
  const results: SourceResult[] = await Promise.all(
    sources.map(async (source): Promise<SourceResult> => {
      try {
        const briefingPage = await findBriefingForDate(notion, source.id, date)
        if (!briefingPage) {
          return {
            sourceLabel: source.label,
            sourceId: source.id,
            briefingPageId: null,
            briefingTitle: null,
            briefing: null,
          }
        }
        const blocks = await fetchAllBlocks(notion, briefingPage.id)
        const briefing = parseBriefingBlocks(blocks)
        return {
          sourceLabel: source.label,
          sourceId: source.id,
          briefingPageId: briefingPage.id,
          briefingTitle: briefingPage.title,
          briefing,
        }
      } catch (err) {
        return {
          sourceLabel: source.label,
          sourceId: source.id,
          briefingPageId: null,
          briefingTitle: null,
          briefing: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    }),
  )

  return NextResponse.json({ date, sources: results, configured: true })
}
