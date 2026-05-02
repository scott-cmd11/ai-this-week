'use client'

import { useState, useEffect } from 'react'

interface StatsData {
  totalPublished: number
  draftsCount: number
  recentPublished: number
  latestIssue: { issueNumber: number; issueDate: string; title: string } | null
}

const CACHE_KEY = 'aitoday:stats-cache'
const CACHE_TTL = 5 * 60 * 1000

export function SiteStats({ password }: { password: string }) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const { data, ts } = JSON.parse(raw) as { data: StatsData; ts: number }
        if (Date.now() - ts < CACHE_TTL) {
          setStats(data)
          setLoading(false)
          return
        }
      }
    } catch { /* corrupt cache — ignore, fall through to fetch */ }

    ;(async () => {
      try {
        const res = await fetch('/api/stats', {
          headers: { 'x-admin-password': password },
        })
        if (!res.ok) { if (!cancelled) setError('Could not load stats.'); return }
        const data = await res.json() as StatsData
        if (!cancelled) {
          setStats(data)
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch { /* storage full */ }
        }
      } catch {
        if (!cancelled) setError('Network error.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [password])

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70 mb-4">Overview</p>

      {loading && <p className="text-[14px] text-ws-black/70">Loading…</p>}
      {error && <p className="text-[14px] text-ws-accent font-bold">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.totalPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Total published</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.recentPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Last 30 days</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.draftsCount}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Unpublished drafts</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            {stats.latestIssue ? (
              <>
                <a
                  href={`/issues/${stats.latestIssue.issueDate}`}
                  className="text-[32px] font-black leading-none hover:text-ws-accent"
                >
                  #{stats.latestIssue.issueNumber}
                </a>
                <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Latest issue</p>
                <p className="text-[11px] text-ws-black/50">{stats.latestIssue.issueDate}</p>
              </>
            ) : (
              <>
                <p className="text-[32px] font-black leading-none">—</p>
                <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Latest issue</p>
              </>
            )}
          </div>
        </div>
      )}

      {stats && (
        <p className="text-[12px] text-ws-black/50 mt-3">
          Visitor data →{' '}
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline hover:text-ws-accent"
          >
            Vercel Analytics dashboard
          </a>
        </p>
      )}
    </div>
  )
}
