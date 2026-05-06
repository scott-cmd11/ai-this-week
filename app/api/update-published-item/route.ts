import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { Client } from '@notionhq/client'
import { getIssueTargetById } from '@/lib/notion-capture'
import { listEditablePublishedIssueItems, richText } from '@/lib/published-issue-editor'

interface RequestBody {
  adminPassword?: string
  issueId?: string
  itemId?: string
  title?: string
  summary?: string
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
  const title = body.title?.trim()
  const summary = body.summary?.trim() ?? ''

  if (!issueId) return NextResponse.json({ error: 'issueId is required.' }, { status: 400 })
  if (!itemId) return NextResponse.json({ error: 'itemId is required.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })

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

  await notion.blocks.update({
    block_id: item.titleBlockId,
    heading_3: { rich_text: richText(title) },
  })

  if (item.summaryBlockId) {
    await notion.blocks.update({
      block_id: item.summaryBlockId,
      paragraph: { rich_text: richText(summary) },
    })
  }

  revalidatePath(`/issues/${issue.issueDate}`)
  revalidatePath('/issues')
  revalidatePath('/', 'layout')

  return NextResponse.json({
    success: true,
    issue,
    item: {
      ...item,
      title,
      summary: item.summaryBlockId ? summary : item.summary,
    },
    path: `/issues/${issue.issueDate}`,
  })
}
