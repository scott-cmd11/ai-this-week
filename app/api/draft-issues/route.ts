import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    const notionToken = process.env.NOTION_TOKEN
    const notionDatabaseId = process.env.NOTION_DATABASE_ID

    if (!adminPassword || !notionToken || !notionDatabaseId) {
      return NextResponse.json(
        { error: 'Server configuration error: missing environment variables.' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const notion = new Client({ auth: notionToken })

    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        property: 'Published',
        checkbox: { equals: false },
      },
      sorts: [{ property: 'Issue Date', direction: 'descending' }],
    })

    const issues: DraftIssue[] = response.results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((page: any) => {
        if (page.object !== 'page' || !('properties' in page)) return null
        const props = page.properties
        const issueDate: string = props['Issue Date']?.date?.start ?? ''
        const title: string = props['Title']?.title?.[0]?.plain_text ?? ''
        const issueNumber: number = props['Issue Number']?.number ?? 0
        return { id: page.id, title, issueDate, issueNumber }
      })
      .filter((item): item is DraftIssue => item !== null)
      // Exclude utility/admin pages that live in the database but aren't
      // real newsletter issues (identified by issueNumber === 0).
      .filter((item) => item.issueNumber > 0)

    return NextResponse.json({ issues }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
