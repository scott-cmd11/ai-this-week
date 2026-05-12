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
const VERCEL_ANALYTICS_URL = 'https://vercel.com/scotts-projects-4ef44000/ai-today/analytics'

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
    } catch { /* corrupt cache, ignore and fetch */ }

    ;(async () => {
      try {
        const res = await fetch('/api/stats', {
          headers: { 'x-admin-password': password },
        })
        if (!res.ok) {
          if (!cancelled) setError('Could not load stats.')
          return
        }
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
    <div className="admin-subpanel bg-ws-white p-5">
      <p className="admin-eyebrow mb-4">Overview</p>

      {loading && <p className="text-[14px] text-ws-black/70">Loading...</p>}
      {error && <p className="text-[14px] text-ws-accent font-bold">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="admin-subpanel px-4 py-3 flex min-h-[96px] flex-col gap-1 bg-ws-page/70">
            <p className="text-[32px] font-black leading-none">{stats.totalPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Total published</p>
          </div>
          <div className="admin-subpanel px-4 py-3 flex min-h-[96px] flex-col gap-1 bg-ws-page/70">
            <p className="text-[32px] font-black leading-none">{stats.recentPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Last 30 days</p>
          </div>
          <div className="admin-subpanel px-4 py-3 flex min-h-[96px] flex-col gap-1 bg-ws-page/70">
            <p className="text-[32px] font-black leading-none">{stats.draftsCount}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Unpublished drafts</p>
          </div>
          <div className="admin-subpanel px-4 py-3 flex min-h-[96px] flex-col gap-1 bg-ws-page/70">
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
                <p className="text-[32px] font-black leading-none">-</p>
                <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Latest issue</p>
              </>
            )}
          </div>
        </div>
      )}

      {stats && (
        <div className="admin-notice mt-4 px-4 py-3">
          <p className="admin-field-label mb-1">
            Usage tracking
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ws-black/65">
            Page views, visitors, referrers, devices, and countries are tracked in Vercel Analytics.
            Custom events now record public page views by type, issue link clicks, outbound source clicks,
            AI Canada Pulse referrals, and issue copy/share tool usage.
          </p>
          <a
            href={VERCEL_ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-[12px] font-bold uppercase tracking-wide text-ws-accent underline hover:no-underline hover:text-ws-accent-hover"
          >
            Open Vercel Analytics
          </a>
        </div>
      )}
    </div>
  )
}
