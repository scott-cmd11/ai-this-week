import { NextRequest, NextResponse } from 'next/server'
import type { CandidateStatus } from '@/lib/article-candidates'
import { coerceCategory } from '@/lib/article-candidates'
import { updateArticleCandidate } from '@/lib/article-candidate-store'

export const dynamic = 'force-dynamic'

interface PatchBody {
  adminPassword?: string
  status?: CandidateStatus
  category?: string
  summary?: string
  rejectionReason?: string | null
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
