'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { compareArticleCandidates, type ArticleCandidate, type CandidateStatus } from '@/lib/article-candidates'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from '@/lib/category-mapping'

type Filter = 'top' | 'needs_review' | 'held' | 'rejected' | 'imported'

interface ImportResult {
  url: string
  title: string
  ok: boolean
  error?: string
  skippedReason?: string
}

const FILTERS: Array<{ key: Filter; label: string; status: string }> = [
  { key: 'top', label: 'Top picks', status: 'new,approved' },
  { key: 'needs_review', label: 'Needs review', status: 'new,approved' },
  { key: 'held', label: 'Held', status: 'shortlisted' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
  { key: 'imported', label: 'Imported', status: 'imported' },
]
const TOP_PICK_SCORE = 75

function sourceLabel(candidate: ArticleCandidate): string {
  if (candidate.source) return candidate.source
  try {
    return new URL(candidate.url).hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown source'
  }
}

function candidateBelongsInFilter(candidate: ArticleCandidate, filter: Filter): boolean {
  if (filter === 'top') {
    return (candidate.status === 'new' || candidate.status === 'approved') && candidate.score >= TOP_PICK_SCORE
  }
  if (filter === 'needs_review') return candidate.status === 'new' || candidate.status === 'approved'
  if (filter === 'held') return candidate.status === 'shortlisted'
  if (filter === 'rejected') return candidate.status === 'rejected'
  return candidate.status === 'imported'
}

function findCandidateImportResult(candidate: ArticleCandidate, results: ImportResult[]): ImportResult | null {
  return results.find(result => result.url === candidate.url) ?? results[0] ?? null
}

function failedImportMessage(result: ImportResult | null): string {
  if (!result) return 'The import did not return a result for this candidate.'
  return result.skippedReason ?? result.error ?? 'The import skipped this candidate.'
}

export function CandidateTriage({
  password,
  onChanged,
}: {
  password: string
  onChanged: () => void
}) {
  const [filter, setFilter] = useState<Filter>('top')
  const [candidates, setCandidates] = useState<ArticleCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const activeFilter = FILTERS.find(item => item.key === filter) ?? FILTERS[0]

  const visibleCandidates = useMemo(() => {
    const list = filter === 'top'
      ? candidates.filter(candidate => candidate.score >= TOP_PICK_SCORE)
      : candidates
    return [...list].sort(compareArticleCandidates)
  }, [candidates, filter])

  const load = useCallback(async (options: { preserveMessage?: boolean } = {}) => {
    setLoading(true)
    setError(null)
    if (!options.preserveMessage) setMessage(null)
    try {
      const res = await fetch(`/api/article-candidates?status=${encodeURIComponent(activeFilter.status)}&limit=100`, {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load candidates (${res.status}).`)
        return
      }
      setCandidates(payload.candidates ?? [])
    } catch {
      setError('Could not load candidates.')
    } finally {
      setLoading(false)
    }
  }, [activeFilter.status, password])

  useEffect(() => {
    void load()
  }, [load])

  async function patchCandidate(
    id: string,
    update: { status?: CandidateStatus; category?: Category },
  ): Promise<ArticleCandidate | null> {
    setWorking(id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/article-candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, ...update }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not update candidate (${res.status}).`)
        return null
      }
      setCandidates(prev => {
        const updated = payload.candidate as ArticleCandidate
        if (update.status && !candidateBelongsInFilter(updated, filter)) {
          return prev.filter(candidate => candidate.id !== id)
        }
        return prev.map(candidate => candidate.id === id ? updated : candidate)
      })
      onChanged()
      return payload.candidate
    } catch {
      setError('Could not update candidate.')
      return null
    } finally {
      setWorking(null)
    }
  }

  async function keep(candidate: ArticleCandidate) {
    setWorking(candidate.id)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          rewriteWithAi: true,
          articles: [{
            title: candidate.title,
            summary: candidate.summary || candidate.scoreReasons.join(' '),
            url: candidate.url,
            category: candidate.category,
          }],
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not keep candidate (${res.status}).`)
        return
      }

      const result = findCandidateImportResult(candidate, payload.results ?? [])
      if (!result?.ok) {
        setError(failedImportMessage(result))
        return
      }

      const updated = await patchCandidate(candidate.id, { status: 'imported' })
      if (!updated) return
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      await load({ preserveMessage: true })
      setMessage(`Kept "${candidate.title}" and added it to today's draft.`)
    } catch {
      setError('Could not keep candidate.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <section className="admin-panel bg-ws-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="admin-eyebrow">Choose</p>
          <h2 className="admin-page-title mt-2">
            Candidate triage
          </h2>
          <p className="admin-copy mt-3 max-w-2xl">
            Review top picks first. Keep adds to today&apos;s draft, Reject clears it, Hold sends it to the future queue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="admin-button-secondary self-start px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`shrink-0 px-3.5 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
              filter === item.key ? 'bg-ws-black text-ws-white' : 'bg-ws-page hover:bg-ws-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}
      {message && <p className="mt-4 border border-ws-black/20 bg-ws-page px-3 py-2 text-[13px] font-bold">{message}</p>}
      {loading && <p className="mt-5 text-[14px] text-ws-black/60">Loading candidates...</p>}

      {!loading && visibleCandidates.length === 0 && (
        <p className="mt-5 border border-ws-border bg-ws-page px-4 py-3 text-[13px] text-ws-black/65">
          No candidates in this view.
        </p>
      )}

      <div className="mt-5 flex flex-col divide-y divide-ws-border">
        {visibleCandidates.map(candidate => (
          <article key={candidate.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-ws-border bg-ws-page px-2 py-0.5 text-[11px] font-black tabular-nums">
                  {candidate.score}
                </span>
                {candidate.score >= TOP_PICK_SCORE && (
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent">
                    Recommended
                  </span>
                )}
                <span className="text-[11px] font-bold text-ws-black/50">{sourceLabel(candidate)}</span>
              </div>
              <h3 className="mt-2 text-[16px] font-black leading-snug">{candidate.title}</h3>
              {candidate.summary && (
                <p className="mt-1 text-[13px] leading-snug text-ws-black/70">{candidate.summary}</p>
              )}
              <a
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-[12px] text-ws-black/50 underline hover:text-ws-black"
              >
                Open source
              </a>
              {candidate.scoreReasons.length > 0 && (
                <p className="mt-2 text-[12px] text-ws-black/45">
                  {candidate.scoreReasons.slice(0, 3).join(' / ')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <select
                value={candidate.category}
                onChange={event => void patchCandidate(candidate.id, { category: event.target.value as Category })}
                disabled={working === candidate.id}
                className="border border-ws-border bg-ws-page px-2 py-2 text-[12px] font-bold"
                aria-label={`Section for ${candidate.title}`}
              >
                {CATEGORY_ORDER.map(category => (
                  <option key={category} value={category}>
                    {CATEGORY_META[category].icon} {category}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void keep(candidate)}
                disabled={working === candidate.id || candidate.status === 'imported'}
                className="admin-button-primary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={async () => {
                  const updated = await patchCandidate(candidate.id, { status: 'rejected' })
                  if (updated) setMessage(`Rejected "${candidate.title}".`)
                }}
                disabled={working === candidate.id || candidate.status === 'rejected'}
                className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={async () => {
                  const updated = await patchCandidate(candidate.id, { status: 'shortlisted' })
                  if (updated) setMessage(`Held "${candidate.title}" for later.`)
                }}
                disabled={working === candidate.id || candidate.status === 'shortlisted'}
                className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
              >
                Hold
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
