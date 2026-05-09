import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getIssueTargetById, removePublishedIssueItem } from '@/lib/issue-store'

interface RequestBody {
  adminPassword?: string
  issueId?: string
  itemId?: string
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const issueId = body.issueId?.trim()
  const itemId = body.itemId?.trim()

  if (!issueId) return NextResponse.json({ error: 'issueId is required.' }, { status: 400 })
  if (!itemId) return NextResponse.json({ error: 'itemId is required.' }, { status: 400 })

  const issue = await getIssueTargetById(issueId)
  if (!issue) {
    return NextResponse.json({ error: 'Published issue not found.' }, { status: 404 })
  }
  if (!issue.published) {
    return NextResponse.json({ error: 'This editor is only for published issues.' }, { status: 400 })
  }

  const item = await removePublishedIssueItem(issue.issueId, itemId)

  revalidatePath(`/issues/${issue.issueDate}`)
  revalidatePath('/issues')
  revalidatePath('/', 'layout')

  return NextResponse.json({
    success: true,
    issue,
    removedItem: {
      id: item.id,
      title: item.title,
      section: item.section,
      blockCount: item.blockIds.length,
    },
    path: `/issues/${issue.issueDate}`,
  })
}
