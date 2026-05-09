import { NextRequest, NextResponse } from 'next/server'
import { getIssueTargetById, listEditablePublishedIssueItems } from '@/lib/issue-store'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
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

  const issue = await getIssueTargetById(issueId)
  if (!issue) {
    return NextResponse.json({ error: 'Published issue not found.' }, { status: 404 })
  }
  if (!issue.published) {
    return NextResponse.json({ error: 'This editor is only for published issues.' }, { status: 400 })
  }

  const items = await listEditablePublishedIssueItems(issue.issueId)
  return NextResponse.json({ issue, items })
}
