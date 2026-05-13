import { NextRequest, NextResponse } from 'next/server'
import type { CandidateStatus } from '@/lib/article-candidates'
import { coerceCategory } from '@/lib/article-candidates'
import { getArticleCandidateById, updateArticleCandidate } from '@/lib/article-candidate-store'
import { buildKnownUrlMap } from '@/lib/known-urls'

export const dynamic = 'force-dynamic'

interface PatchBody {
  adminPassword?: string
  status?: CandidateStatus
  category?: string
  summary?: string
  rejectionReason?: string | null
  importedIssueId?: string
  importedIssueDate?: string
}

function isAuthorized(request: NextRequest, body?: { adminPassword?: string }): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  const headerPassword = request.headers.get('x-admin-password')
  return !!adminPassword && (headerPassword === adminPassword || body?.adminPassword === adminPassword)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isAuthorized(request, body)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const allowed = new Set<CandidateStatus>(['new', 'shortlisted', 'approved', 'rejected', 'imported'])
  if (body.status && !allowed.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  try {
    const { id } = await context.params
    if (body.status === 'imported') {
      const candidate = await getArticleCandidateById(id)
      if (!candidate) return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
      const knownUrls = await buildKnownUrlMap(90)
      const importedIssue = knownUrls.get(candidate.canonicalUrl)
      const issueMatches = importedIssue
        && (!body.importedIssueId || importedIssue.pageId === body.importedIssueId)
        && (!body.importedIssueDate || importedIssue.issueDate === body.importedIssueDate)

      if (!body.importedIssueId || !body.importedIssueDate || !issueMatches) {
        return NextResponse.json({
          error: 'Candidate cannot be marked imported until its URL is found in the intended issue.',
          expectedIssueId: body.importedIssueId ?? null,
          expectedIssueDate: body.importedIssueDate ?? null,
          matchedIssue: importedIssue
            ? {
                id: importedIssue.pageId,
                issueNumber: importedIssue.issueNumber,
                issueDate: importedIssue.issueDate,
                published: importedIssue.published,
              }
            : null,
        }, { status: 409 })
      }
    }

    const candidate = await updateArticleCandidate(id, {
      status: body.status,
      category: body.category ? coerceCategory(body.category) : undefined,
      summary: body.summary,
      rejectionReason: body.rejectionReason,
    })
    return NextResponse.json({ candidate })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
