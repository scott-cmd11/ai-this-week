import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { captureEventToTodaysDraft } from '@/lib/notion-capture'
import { buildKnownUrlMap } from '@/lib/known-urls'
import { normalizeUrl } from '@/lib/url-normalize'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  adminPassword?: string
  title?: string
  when?: string
  where?: string
  description?: string
  url?: string
  /** When true, skip the duplicate-URL check. */
  force?: boolean
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!adminPassword || !notionToken || !notionDatabaseId) {
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

  const title = body.title?.trim()
  const url = body.url?.trim()
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid registration URL is required.' }, { status: 400 })
  }

  const notion = new Client({ auth: notionToken })

  try {
    // Duplicate check — same backstop as /api/capture
    if (!body.force) {
      const knownMap = await buildKnownUrlMap(notion, notionDatabaseId, 30)
      const existing = knownMap.get(normalizeUrl(url))
      if (existing) {
        return NextResponse.json({
          error: 'duplicate',
          message: `This event URL was already added to Issue #${existing.issueNumber} on ${existing.issueDate}${existing.published ? ' (published)' : ' (draft)'}. Re-submit with force: true to add anyway.`,
          duplicate: existing,
        }, { status: 409 })
      }
    }

    const result = await captureEventToTodaysDraft(notion, notionDatabaseId, {
      title,
      when: body.when?.trim() ?? '',
      where: body.where?.trim() ?? '',
      description: body.description?.trim() || null,
      url,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
