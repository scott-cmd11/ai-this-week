import { NextRequest, NextResponse } from 'next/server'
import { getPublishedIssues } from '@/lib/issue-store'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const issues = (await getPublishedIssues()).slice(0, 10).map(issue => ({
    id: issue.id,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    title: issue.title,
  }))

  return NextResponse.json({ issues })
}
