import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { normalizeUrl } from '@/lib/url-normalize'

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Walk all blocks in a page, paginated, and collect bookmark URLs.
 * Issues are small (~100 blocks) so this is cheap.
 */
async function fetchBookmarkUrls(notion: Client, pageId: string): Promise<string[]> {
  const urls: string[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    for (const b of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = b as any
      if (block.type === 'bookmark' && typeof block.bookmark?.url === 'string') {
        urls.push(block.bookmark.url)
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)
  return urls
}

function todayUtc(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgoUtc(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

/**
 * Returns the set of normalized URLs that have appeared in any issue
 * (published OR draft) within the last `days` days. Used by import panels
 * to flag and pre-uncheck duplicate articles.
 *
 * Default window: 30 days. Configurable via ?days=N (capped at 365).
 */
export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!adminPassword || !notionToken || !notionDatabaseId) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  const password = request.nextUrl.searchParams.get('password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const daysParam = request.nextUrl.searchParams.get('days')
  const days = Math.min(Math.max(parseInt(daysParam ?? '30', 10) || 30, 1), 365)

  const sinceDate = daysAgoUtc(days)
  const today = todayUtc()

  const notion = new Client({ auth: notionToken })

  try {
    // Query all issues (published OR draft) in the window
    const queryRes = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        property: 'Issue Date',
        date: { on_or_after: sinceDate },
      },
      sorts: [{ property: 'Issue Date', direction: 'descending' }],
      page_size: 100,
    })

    const issues = queryRes.results
      .filter(p => p.object === 'page')
      .map(p => p.id)

    // Fetch bookmarks from every issue in parallel
    const allUrlsArrays = await Promise.all(issues.map(id => fetchBookmarkUrls(notion, id)))
    const flat = allUrlsArrays.flat()

    // Normalize + dedupe
    const normalized = new Set<string>()
    for (const u of flat) {
      const n = normalizeUrl(u)
      if (n) normalized.add(n)
    }

    return NextResponse.json({
      urls: [...normalized],
      windowDays: days,
      since: sinceDate,
      today,
      issueCount: issues.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
