import { NextRequest, NextResponse } from 'next/server'
import { buildIssueReadiness, getAdminRunSummaries } from '@/lib/admin-issue-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { getIssueByDate, getIssueBlocks } from '@/lib/issue-store'
import { buildPublishingPreflight } from '@/lib/publishing-preflight'

export const dynamic = 'force-dynamic'

function authorize(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return { ok: false as const, status: 500, error: 'Server configuration error.' }
  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) return { ok: false as const, status: 401, error: 'Incorrect password.' }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const today = request.nextUrl.searchParams.get('date') ?? issueDateFor()
  const draft = await getIssueByDate(today, false)
  const blocks = draft ? await getIssueBlocks(draft.id) : []

  const { candidates, automation, candidateError } = await getAdminRunSummaries()

  const { draftSummary, readiness, eveningBriefing } = await buildIssueReadiness({
    issueDate: today,
    draft,
    blocks,
    candidates,
    automation,
  })
  const preflight = buildPublishingPreflight({
    issueDate: today,
    automation,
    candidates,
    draft: draftSummary,
    readiness,
    eveningBriefing,
  })

  return NextResponse.json({
    issueDate: today,
    automation,
    candidates,
    candidateError,
    draft: draftSummary,
    readiness,
    eveningBriefing,
    preflight,
  })
}
