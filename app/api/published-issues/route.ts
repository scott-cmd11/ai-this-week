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

  const res = await notion.databases.query({
    database_id: notionDatabaseId,
    filter: { property: 'Published', checkbox: { equals: true } },
    sorts: [{ property: 'Issue Date', direction: 'descending' }],
    page_size: 10,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues = res.results.flatMap((page: any) => {
    if (page.object !== 'page' || !('properties' in page)) return []
    const props = page.properties
    const issueNumber: number = props['Issue Number']?.number ?? 0
    if (!issueNumber) return []
    return [{
      id: page.id as string,
      issueNumber,
      issueDate: props['Issue Date']?.date?.start ?? '',
      title: props['Title']?.title?.[0]?.plain_text ?? '',
    }]
  })

  return NextResponse.json({ issues })
}
