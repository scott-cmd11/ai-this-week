import 'server-only'

import type { ArticleCandidate, CandidateStatus, NormalizedArticleCandidate } from './article-candidates'

interface CandidateRow {
  id: string
  title: string
  url: string
  canonical_url: string
  summary: string | null
  source: string
  source_type: string
  published_at: string | null
  category: string
  status: CandidateStatus
  score: number
  score_reasons: string[] | null
  rejection_reason: string | null
  reviewed_at: string | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

export interface CandidateListOptions {
  statuses?: CandidateStatus[]
  limit?: number
}

export interface CandidateUpdate {
  status?: CandidateStatus
  category?: string
  summary?: string
  rejectionReason?: string | null
}

export function isArticleCandidateStoreConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Article candidate inbox is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return { url: url.replace(/\/$/, ''), key }
}

function toCandidate(row: CandidateRow): ArticleCandidate {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    canonicalUrl: row.canonical_url,
    summary: row.summary ?? '',
    source: row.source,
    sourceType: row.source_type as ArticleCandidate['sourceType'],
    publishedAt: row.published_at,
    category: row.category as ArticleCandidate['category'],
    status: row.status,
    score: row.score,
    scoreReasons: row.score_reasons ?? [],
    rejectionReason: row.rejection_reason,
    reviewedAt: row.reviewed_at,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(candidate: NormalizedArticleCandidate) {
  return {
    title: candidate.title,
    url: candidate.url,
    canonical_url: candidate.canonicalUrl,
    summary: candidate.summary,
    source: candidate.source,
    source_type: candidate.sourceType,
    published_at: candidate.publishedAt,
    category: candidate.category,
    status: candidate.status,
    score: candidate.score,
    score_reasons: candidate.scoreReasons,
  }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseConfig()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase request failed (${res.status}): ${body || res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function listArticleCandidates(options: CandidateListOptions = {}): Promise<ArticleCandidate[]> {
  const statuses = options.statuses?.length ? options.statuses : ['new', 'shortlisted', 'approved']
  const limit = Math.max(1, Math.min(options.limit ?? 75, 150))
  const params = new URLSearchParams({
    select: '*',
    order: 'score.desc,created_at.desc',
    limit: String(limit),
  })
  params.set('status', `in.(${statuses.join(',')})`)
  const rows = await supabaseRequest<CandidateRow[]>(`article_candidates?${params.toString()}`)
  return rows.map(toCandidate)
}

export async function upsertArticleCandidates(candidates: NormalizedArticleCandidate[]): Promise<ArticleCandidate[]> {
  if (candidates.length === 0) return []
  const rows = candidates.map(toRow)
  const result = await supabaseRequest<CandidateRow[]>('article_candidates?on_conflict=canonical_url', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })
  return result.map(toCandidate)
}

export async function updateArticleCandidate(id: string, update: CandidateUpdate): Promise<ArticleCandidate> {
  const now = new Date().toISOString()
  const body: Record<string, unknown> = {}
  if (update.status) {
    body.status = update.status
    if (update.status === 'approved' || update.status === 'rejected') body.reviewed_at = now
    if (update.status === 'imported') {
      body.reviewed_at = now
      body.imported_at = now
    }
  }
  if (update.category) body.category = update.category
  if (update.summary !== undefined) body.summary = update.summary
  if (update.rejectionReason !== undefined) body.rejection_reason = update.rejectionReason
  body.updated_at = now

  const rows = await supabaseRequest<CandidateRow[]>(`article_candidates?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!rows[0]) throw new Error('Candidate not found.')
  return toCandidate(rows[0])
}
