import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { getIssueTargetById } from '@/lib/notion-capture'
import { listEditablePublishedIssueItems } from '@/lib/published-issue-editor'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN

  if (!adminPassword || !notionToken) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const issueId = request.nextUrl.searchParams.get('issueId')
  if (!issueId) {
    return NextResponse.json({ error: 'issueId is required.' }, { status: 400 })
  }

  const notion = new Client({ auth: notionToken })
  const issue = await getIssueTargetById(notion, issueId)
  if (!issue) {
    return NextResponse.json({ error: 'Published issue not found.' }, { status: 404 })
  }
  if (!issue.published) {
    return NextResponse.json({ error: 'This editor is only for published issues.' }, { status: 400 })
  }

  const items = await listEditablePublishedIssueItems(notion, issue.issueId)
  return NextResponse.json({ issue, items })
}
