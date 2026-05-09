import { NextRequest, NextResponse } from 'next/server'
import { listAllIssues } from '@/lib/issue-store'

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const issues = await listAllIssues()
  const published = issues.filter(issue => issue.published)
  const drafts = issues.filter(issue => !issue.published)

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
