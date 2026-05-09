import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { issueDateFor } from '@/lib/issue-date'
import { getIssueBlocks, getIssueByDate, publishIssue } from '@/lib/issue-store'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const today = issueDateFor()
    const draft = await getIssueByDate(today, false)

    if (!draft || draft.published) {
      return NextResponse.json({ skipped: true, reason: 'no_draft' })
    }

    const blocks = await getIssueBlocks(draft.id)
    const articleCount = blocks.filter(block => block.type === 'heading_3').length

    if (articleCount === 0) {
      return NextResponse.json({ skipped: true, reason: 'empty' })
    }

    await publishIssue(draft.id)
    revalidatePath('/', 'layout')

    return NextResponse.json({
      published: true,
      issueId: draft.id,
      issueNumber: draft.issueNumber,
      issueDate: draft.issueDate,
      articleCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
