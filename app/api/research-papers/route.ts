import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { fetchResearchPapersForDate } from '@/lib/research-papers'
import { issueDateFor } from '@/lib/issue-date'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionResearchDbId = process.env.NOTION_RESEARCH_DB_ID

  if (!adminPassword || !notionToken) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date') ?? issueDateFor()
  const notion = new Client({ auth: notionToken })

  try {
    const { papers, databaseIdsChecked } = await fetchResearchPapersForDate(
      notion,
      notionResearchDbId,
      date,
    )

    return NextResponse.json({
      papers,
      date,
      configured: databaseIdsChecked.length > 0,
      databaseIdsChecked,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
