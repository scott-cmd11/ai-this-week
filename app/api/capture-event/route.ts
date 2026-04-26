import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { captureEventToTodaysDraft } from '@/lib/notion-capture'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  adminPassword?: string
  title?: string
  when?: string
  where?: string
  description?: string
  url?: string
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
