import { NextRequest, NextResponse } from 'next/server'
import { getIssueTargetById, listEditablePublishedIssueItems } from '@/lib/issue-store'

type SectionKey = 'top' | 'bright' | 'tool' | 'podcast' | 'learning' | 'deep'

interface SectionSummary {
  url: string
  title: string | null
  summary: string
  publishedDate: string | null
}

function detectSection(text: string): SectionKey {
  const lower = text.toLowerCase()
  if (lower.includes('bright')) return 'bright'
  if (lower.includes('tool')) return 'tool'
  if (lower.includes('podcast')) return 'podcast'
  if (lower.includes('learning') || lower.includes('upcoming')) return 'learning'
  if (lower.includes('deep')) return 'deep'
  return 'top'
}

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const password = request.headers.get('x-admin-password')
  const pageId = searchParams.get('pageId')

  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId.' }, { status: 400 })
  }

  const issue = await getIssueTargetById(pageId)
  if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
  const items = await listEditablePublishedIssueItems(pageId)
  const summaries: Record<SectionKey, SectionSummary[]> = {
    top: [], bright: [], tool: [], podcast: [], learning: [], deep: [],
  }

  for (const item of items) {
    if (!item.sourceUrl || !item.summary) continue
    summaries[detectSection(item.section)].push({
      url: item.sourceUrl,
      title: item.title,
      summary: item.summary,
      publishedDate: item.publishedDate,
    })
  }

  return NextResponse.json({
    summaries,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
  })
}
