import { NextRequest, NextResponse } from 'next/server'
import { buildIssueReadiness } from '@/lib/admin-issue-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { isArticleCandidateStoreConfigured, summarizeArticleCandidates } from '@/lib/article-candidate-store'
import { getIssueByDate, getIssueBlocks } from '@/lib/issue-store'

export const dynamic = 'force-dynamic'

const EMPTY_CANDIDATES = { totalActive: 0, topPicks: 0, held: 0, rejected: 0, imported: 0 }

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

  const candidateStoreConfigured = isArticleCandidateStoreConfigured()
  let candidates = EMPTY_CANDIDATES
  let candidateError: string | null = candidateStoreConfigured ? null : 'Article candidate inbox is not configured.'
  if (candidateStoreConfigured) {
    try {
      candidates = await summarizeArticleCandidates()
    } catch (err) {
      candidateError = err instanceof Error ? err.message : 'Candidate summary failed.'
    }
  }

  const automation = {
    lastRunAt: null,
    sourceCount: 0,
    failureCount: candidateError ? 1 : 0,
  }

  const { draftSummary, readiness } = await buildIssueReadiness({
    issueDate: today,
    draft,
    blocks,
    candidates,
    automation,
  })

  return NextResponse.json({
    issueDate: today,
    automation,
    candidates,
    candidateError,
    draft: draftSummary,
    readiness,
  })
}
