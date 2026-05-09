import { NextRequest, NextResponse } from 'next/server'
import type { CandidateStatus, IncomingArticleCandidate } from '@/lib/article-candidates'
import { normalizeArticleCandidates } from '@/lib/article-candidates'
import { listArticleCandidates, upsertArticleCandidates } from '@/lib/article-candidate-store'

export const dynamic = 'force-dynamic'

interface CandidatePostBody {
  adminPassword?: string
  candidates?: IncomingArticleCandidate[]
}

function bearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  return auth.slice('bearer '.length).trim()
}

function isAuthorized(request: NextRequest, body?: { adminPassword?: string }): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  const headerPassword = request.headers.get('x-admin-password')
  if (adminPassword && (headerPassword === adminPassword || body?.adminPassword === adminPassword)) return true

  const token = bearerToken(request)
  const ingestToken = process.env.ARTICLE_CANDIDATE_INGEST_TOKEN || process.env.CRON_SECRET
  return !!token && !!ingestToken && token === ingestToken
}

function statusesFromSearch(request: NextRequest): CandidateStatus[] | undefined {
  const raw = request.nextUrl.searchParams.get('status')
  if (!raw) return undefined
  const values = raw.split(',').map(s => s.trim()).filter(Boolean)
  const allowed = new Set<CandidateStatus>(['new', 'shortlisted', 'approved', 'rejected', 'imported'])
  return values.filter((value): value is CandidateStatus => allowed.has(value as CandidateStatus))
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const candidates = await listArticleCandidates({
      statuses: statusesFromSearch(request),
      limit: Number(request.nextUrl.searchParams.get('limit') ?? 75),
    })
    return NextResponse.json({ candidates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let body: CandidatePostBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!isAuthorized(request, body)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
    return NextResponse.json({ error: 'No candidates provided.' }, { status: 400 })
  }

  try {
    const normalized = normalizeArticleCandidates(body.candidates)
    const candidates = await upsertArticleCandidates(normalized)
    return NextResponse.json({
      added: candidates.length,
      candidates,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
