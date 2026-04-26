import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { parseBriefingBlocks, type ParsedBriefing } from '@/lib/briefing-parser'

// ─── Types ──────────────────────────────────────────────────────────────────────

type SourceType = 'page' | 'database'

interface SourceConfig {
  id: string                 // Notion page ID OR database ID
  label: string              // Human-readable label shown in admin UI
  type: SourceType           // 'page' = parent page with date-named child pages
                             // 'database' = database with date property + per-row body
  dateProperty?: string      // Database-only: name of the date property to filter on (default 'Date')
}

interface SourceResult {
  sourceLabel: string
  sourceId: string
  sourceType: SourceType
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
      .map(s => ({
        id: s.id as string,
        label: s.label as string,
        // Default to 'page' for backward compat with existing config
        type: (s.type === 'database' ? 'database' : 'page') as SourceType,
        dateProperty: typeof s.dateProperty === 'string' ? s.dateProperty : undefined,
      }))
  } catch {
    return []
  }
}

/**
 * Page-source resolver: list all child_page blocks under a parent page and
 * find the one whose title contains the given date string (YYYY-MM-DD).
 *
 * Briefing pages are named like "AI Adoption in Canada — Daily Briefing (2026-04-25)"
 * — we just look for the date substring anywhere in the title.
 */
async function findPageBriefingForDate(
  notion: Client,
  parentPageId: string,
  date: string,
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
  return null
}

/**
 * Database-source resolver: query the database for a row whose date property
 * matches the given date. Returns the first match.
 */
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
  // Title comes from the row's title-type property (could be 'Name', 'Title', etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = row.properties ?? {}
  let title = ''
  for (const key of Object.keys(props)) {
    const p = props[key]
    if (p?.type === 'title' && Array.isArray(p.title) && p.title.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      title = p.title.map((t: any) => t.plain_text ?? '').join('')
      break
    }
  }
  return { id: row.id, title: title || `(row ${date})` }
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
        const briefingPage = source.type === 'database'
          ? await findDatabaseBriefingForDate(notion, source.id, date, source.dateProperty ?? 'Date')
          : await findPageBriefingForDate(notion, source.id, date)

        if (!briefingPage) {
          return {
            sourceLabel: source.label,
            sourceId: source.id,
            sourceType: source.type,
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
          sourceType: source.type,
          briefingPageId: briefingPage.id,
          briefingTitle: briefingPage.title,
          briefing,
        }
      } catch (err) {
        return {
          sourceLabel: source.label,
          sourceId: source.id,
          sourceType: source.type,
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
