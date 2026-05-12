import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { buildIssueReadiness, getAdminRunSummaries } from '@/lib/admin-issue-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { getIssueBlocks, getIssueByDate, publishIssue } from '@/lib/issue-store'
import { buildIssuePublishSummary } from '@/lib/issue-publish-summary'

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
    const { candidates, automation } = await getAdminRunSummaries()
    const { draftSummary, readiness } = await buildIssueReadiness({
      issueDate: today,
      draft,
      blocks,
      candidates,
      automation,
    })
    const articleCount = draftSummary.articleCount

    if (articleCount === 0) {
      return NextResponse.json({ skipped: true, reason: 'empty' })
    }

    if (readiness.blockers.length > 0 || readiness.warnings.length > 0) {
      return NextResponse.json({
        skipped: true,
        reason: 'publish_readiness',
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      })
    }

    const summary = await buildIssuePublishSummary(draft, blocks)
    await publishIssue(draft.id, { summary })
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
