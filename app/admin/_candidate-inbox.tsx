'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import type { ArticleCandidate, CandidateStatus } from '@/lib/article-candidates'

type CandidateFilter = 'active' | CandidateStatus

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function statusLabel(status: CandidateStatus): string {
  if (status === 'new') return 'New'
  if (status === 'shortlisted') return 'Shortlisted'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return 'Imported'
}

export function CandidateInbox({ password }: { password: string }) {
  const [candidates, setCandidates] = useState<ArticleCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<CandidateFilter>('active')
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const statusQuery = filter === 'active' ? 'new,shortlisted,approved' : filter

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/article-candidates?status=${encodeURIComponent(statusQuery)}`, {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      setConfigured(payload.configured !== false)
      setCandidates(payload.candidates ?? [])
      setSelected(new Set())
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const selectedCandidates = useMemo(
    () => candidates.filter(candidate => selected.has(candidate.id)),
    [candidates, selected],
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function patchCandidate(id: string, update: { status?: CandidateStatus; category?: Category; summary?: string }) {
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
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      setCandidates(prev => prev.map(candidate => candidate.id === id ? payload.candidate : candidate))
    } catch {
      setError('Network error.')
    } finally {
      setWorking(null)
    }
  }

  async function importSelected() {
    if (selectedCandidates.length === 0) return
    setImporting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          rewriteWithAi: true,
          articles: selectedCandidates.map(candidate => ({
            title: candidate.title,
            summary: candidate.summary || candidate.scoreReasons.join(' '),
            url: candidate.url,
            category: candidate.category,
          })),
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }

      const importedUrls = new Set(
        (payload.results ?? [])
          .filter((result: { ok: boolean }) => result.ok)
          .map((result: { url: string }) => result.url),
      )
      const importedIds = selectedCandidates
        .filter(candidate => importedUrls.has(candidate.url))
        .map(candidate => candidate.id)

      await Promise.all(importedIds.map(id =>
        fetch(`/api/article-candidates/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: password, status: 'imported' }),
        }),
      ))

      setMessage(`Imported ${payload.added} of ${payload.attempted} selected candidate${payload.attempted === 1 ? '' : 's'} into today's draft.`)
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      await load()
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  const statusCounts = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.status] = (acc[candidate.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">
            Candidate inbox
          </p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">
            Normalized article queue from source automations. Review here before anything enters the Notion draft.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filter}
            onChange={event => setFilter(event.target.value as CandidateFilter)}
            className="border-[2px] border-ws-black bg-ws-white px-2 py-1 text-[12px] font-bold"
            aria-label="Candidate status filter"
          >
            <option value="active">Active queue</option>
            <option value="new">New</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="imported">Imported</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-[12px] text-ws-black/60">
        <span>New: {statusCounts.new ?? 0}</span>
        <span>Shortlisted: {statusCounts.shortlisted ?? 0}</span>
        <span>Approved: {statusCounts.approved ?? 0}</span>
        <span>Selected: {selected.size}</span>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}
      {!configured && (
        <p className="border-[2px] border-ws-black/20 bg-ws-page px-4 py-3 text-[13px] text-ws-black/70">
          Candidate inbox is ready, but Supabase is not connected yet. Add the Supabase environment variables and run the schema SQL, then refresh this panel.
        </p>
      )}

      {configured && selected.size > 0 && (
        <div className="border-[2px] border-ws-black bg-ws-page px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] font-bold text-ws-black">
            {selected.size} candidate{selected.size === 1 ? '' : 's'} selected for today&apos;s draft.
          </p>
          <button
            type="button"
            onClick={importSelected}
            disabled={importing}
            className="bg-ws-accent text-white rounded-sm px-4 py-2 text-[13px] font-semibold hover:bg-ws-accent-hover hover:-translate-y-px transition-all disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import selected'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-ws-black/55">Loading candidates...</p>
      ) : !configured ? null : candidates.length === 0 ? (
        <p className="border-[2px] border-ws-black/20 bg-ws-page px-4 py-3 text-[13px] text-ws-black/70">
          No candidates in this view. Once automations post to the candidate API, they will appear here before Notion is touched.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ws-black/10">
          {candidates.map(candidate => (
            <li key={candidate.id} className="py-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(candidate.id)}
                  onChange={() => toggle(candidate.id)}
                  disabled={candidate.status === 'rejected' || candidate.status === 'imported'}
                  className="mt-1 h-4 w-4"
                  aria-label={`Select ${candidate.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="border-[2px] border-ws-black px-2 py-0.5 text-[11px] font-black tabular-nums">
                      {candidate.score}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/45">
                      {statusLabel(candidate.status)}
                    </span>
                    <span className="text-[11px] font-bold text-ws-black/50">
                      {candidate.source}
                    </span>
                  </div>
                  <p className="text-[15px] font-semibold leading-snug">{candidate.title}</p>
                  {candidate.summary && (
                    <p className="text-[13px] text-ws-black/70 mt-1">{candidate.summary}</p>
                  )}
                  <a
                    href={candidate.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-ws-black/50 underline hover:no-underline mt-1 inline-block"
                  >
                    {hostname(candidate.url)}
                  </a>
                  {candidate.scoreReasons.length > 0 && (
                    <p className="text-[12px] text-ws-black/45 mt-1">
                      {candidate.scoreReasons.slice(0, 3).join(' / ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap pl-7">
                <select
                  value={candidate.category}
                  onChange={event => patchCandidate(candidate.id, { category: event.target.value as Category })}
                  disabled={working === candidate.id}
                  className="border border-ws-border bg-ws-white px-2 py-1 text-[12px]"
                  aria-label={`Category for ${candidate.title}`}
                >
                  {CATEGORY_ORDER.map(category => (
                    <option key={category} value={category}>
                      {CATEGORY_META[category].icon} {category}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => patchCandidate(candidate.id, { status: 'shortlisted' })}
                  disabled={working === candidate.id || candidate.status === 'shortlisted'}
                  className="border border-ws-border px-3 py-1 text-[12px] font-bold hover:border-ws-accent disabled:opacity-40"
                >
                  Shortlist
                </button>
                <button
                  type="button"
                  onClick={() => patchCandidate(candidate.id, { status: 'approved' })}
                  disabled={working === candidate.id || candidate.status === 'approved'}
                  className="border border-ws-border px-3 py-1 text-[12px] font-bold hover:border-ws-accent disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => patchCandidate(candidate.id, { status: 'rejected' })}
                  disabled={working === candidate.id || candidate.status === 'rejected'}
                  className="border border-ws-border px-3 py-1 text-[12px] font-bold hover:border-ws-accent disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
