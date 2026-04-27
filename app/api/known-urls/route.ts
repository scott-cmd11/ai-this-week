import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { buildKnownUrlMap } from '@/lib/known-urls'

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

  const notion = new Client({ auth: notionToken })

  try {
    const map = await buildKnownUrlMap(notion, notionDatabaseId, days)

    return NextResponse.json({
      urls: [...map.keys()],
      windowDays: days,
      issueCount: new Set([...map.values()].map(v => v.pageId)).size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
