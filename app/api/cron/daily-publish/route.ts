import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { buildIssueReadiness, getAdminRunSummaries } from '@/lib/admin-issue-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { getIssueBlocks, getIssueByDate, publishIssue } from '@/lib/issue-store'
import { buildIssuePublishSummary } from '@/lib/issue-publish-summary'
import { MIN_DAILY_ISSUE_ARTICLES, splitShortIssueBlockers } from '@/lib/publish-policy'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true'
  const dateOverride = url.searchParams.get('date') ?? undefined
  return evaluateDailyPublish({ dryRun, dateOverride })
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error: missing ADMIN_PASSWORD.' }, { status: 500 })
  }

  let body: { adminPassword?: string; dryRun?: boolean; date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (body.dryRun !== true) {
    return NextResponse.json({ error: 'POST /api/cron/daily-publish is read-only and requires dryRun: true.' }, { status: 400 })
  }

  return evaluateDailyPublish({ dryRun: true, dateOverride: body.date })
}

function withDryRun<T extends Record<string, unknown>>(payload: T, dryRun: boolean): T & { dryRun?: true } {
  return dryRun ? { ...payload, dryRun: true } : payload
}

async function evaluateDailyPublish({
  dryRun,
  dateOverride,
}: {
  dryRun: boolean
  dateOverride?: string
}) {
  try {
    const today = dateOverride ?? issueDateFor()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
    }

    const draft = await getIssueByDate(today, false)

    if (!draft || draft.published) {
      return NextResponse.json(withDryRun({ skipped: true, reason: 'no_draft', issueDate: today }, dryRun))
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
      return NextResponse.json(withDryRun({ skipped: true, reason: 'empty', issueDate: today }, dryRun))
    }

    const { hasShortIssueBlocker } = splitShortIssueBlockers(readiness.blockers)
    if (hasShortIssueBlocker) {
      return NextResponse.json(withDryRun({
        skipped: true,
        reason: 'low_article_count',
        issueDate: today,
        articleCount,
        minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      }, dryRun))
    }

    if (readiness.blockers.length > 0 || readiness.warnings.length > 0) {
      return NextResponse.json(withDryRun({
        skipped: true,
        reason: 'publish_readiness',
        issueDate: today,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      }, dryRun))
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        publishable: true,
        reason: 'ready',
        issueId: draft.id,
        issueNumber: draft.issueNumber,
        issueDate: draft.issueDate,
        articleCount,
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
