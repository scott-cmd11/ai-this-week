import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { revalidatePath } from 'next/cache'

// Called by Vercel Cron at 23:00 UTC (= 6pm Central).
// Publishes today's draft if it exists and has at least one article.

export async function GET(request: NextRequest) {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // ─── Env ──────────────────────────────────────────────────────────────────
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!notionToken || !notionDatabaseId) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 }
    )
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const notion = new Client({ auth: notionToken })

    // Query for today's draft
    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        and: [
          { property: 'Published', checkbox: { equals: false } },
          { property: 'Issue Date', date: { equals: today } },
        ],
      },
    })

    if (response.results.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no_draft' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = response.results[0] as any
    const draftId: string = page.id
    const props = page.properties
    const issueNumber: number = props['Issue Number']?.number ?? 0
    const issueDate: string = props['Issue Date']?.date?.start ?? today

    // Count heading_3 blocks to determine article count
    const blocksResponse = await notion.blocks.children.list({ block_id: draftId })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const articleCount = (blocksResponse.results as any[]).filter(
      (b) => b.type === 'heading_3'
    ).length

    if (articleCount === 0) {
      return NextResponse.json({ skipped: true, reason: 'empty' })
    }

    // Publish the page
    await notion.pages.update({
      page_id: draftId,
      properties: {
        Published: { checkbox: true },
      },
    })

    // Invalidate public cache
    revalidatePath('/', 'layout')

    return NextResponse.json({ published: true, issueId: draftId, issueNumber, issueDate, articleCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
