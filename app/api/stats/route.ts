import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!adminPassword || !notionToken || !notionDatabaseId) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const notion = new Client({ auth: notionToken })

  // Fetch published and draft issues in parallel
  const [publishedRes, draftRes] = await Promise.all([
    notion.databases.query({
      database_id: notionDatabaseId,
      filter: { property: 'Published', checkbox: { equals: true } },
      sorts: [{ property: 'Issue Date', direction: 'descending' }],
      page_size: 100,
    }),
    notion.databases.query({
      database_id: notionDatabaseId,
      filter: { property: 'Published', checkbox: { equals: false } },
      sorts: [{ property: 'Issue Date', direction: 'descending' }],
      page_size: 100,
    }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractIssue(page: any) {
    if (page.object !== 'page' || !('properties' in page)) return null
    const props = page.properties
    const issueNumber: number = props['Issue Number']?.number ?? 0
    if (issueNumber === 0) return null
    return {
      issueNumber,
      issueDate: props['Issue Date']?.date?.start ?? '',
      title: props['Title']?.title?.[0]?.plain_text ?? '',
    }
  }

  const published = publishedRes.results.map(extractIssue).filter(Boolean) as {
    issueNumber: number; issueDate: string; title: string
  }[]

  const drafts = draftRes.results.map(extractIssue).filter(Boolean) as {
    issueNumber: number; issueDate: string; title: string
  }[]

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentCount = published.filter(i => i.issueDate && new Date(i.issueDate) >= thirtyDaysAgo).length

  return NextResponse.json({
    totalPublished: published.length,
    draftsCount: drafts.length,
    recentPublished: recentCount,
    latestIssue: published[0] ?? null,
  })
}
