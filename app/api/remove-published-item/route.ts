import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Client } from '@notionhq/client'
import { getIssueTargetById } from '@/lib/notion-capture'
import { listEditablePublishedIssueItems } from '@/lib/published-issue-editor'

interface RequestBody {
  adminPassword?: string
  issueId?: string
  itemId?: string
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN

  if (!adminPassword || !notionToken) {
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

  const notion = new Client({ auth: notionToken })
  const issue = await getIssueTargetById(notion, issueId)
  if (!issue) {
    return NextResponse.json({ error: 'Published issue not found.' }, { status: 404 })
  }
  if (!issue.published) {
    return NextResponse.json({ error: 'This editor is only for published issues.' }, { status: 400 })
  }

  const items = await listEditablePublishedIssueItems(notion, issue.issueId)
  const item = items.find(candidate => candidate.id === itemId)
  if (!item) {
    return NextResponse.json({ error: 'Item not found in this issue.' }, { status: 404 })
  }
  if (item.blockIds.length === 0) {
    return NextResponse.json({ error: 'This item has no removable blocks.' }, { status: 400 })
  }

  for (const blockId of [...new Set(item.blockIds)]) {
    await notion.blocks.delete({ block_id: blockId })
  }

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
