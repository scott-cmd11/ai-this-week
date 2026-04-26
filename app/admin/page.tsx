'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

interface DailyArticle {
  title: string | null
  annotation: string | null
  url: string | null
  imageUrl: string | null
}

interface PublishedIssue {
  id: string
  issueNumber: number
  issueDate: string
  title: string
}

interface StatsData {
  totalPublished: number
  draftsCount: number
  recentPublished: number
  latestIssue: { issueNumber: number; issueDate: string; title: string } | null
}

// ─── SiteStats ───────────────────────────────────────────────────────────────────

function SiteStats({ password }: { password: string }) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/stats?password=${encodeURIComponent(password)}`)
        if (!res.ok) { setError('Could not load stats.'); return }
        const data = await res.json() as StatsData
        if (!cancelled) setStats(data)
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
      <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70 mb-4">Site stats</p>

      {loading && <p className="text-[14px] text-ws-black/70">Loading…</p>}
      {error && <p className="text-[14px] text-ws-accent font-bold">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.totalPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Published issues</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.recentPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Issues last 30 days</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.draftsCount}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Drafts in queue</p>
          </div>
          <div className="border-[2px] border-ws-black px-4 py-3 flex flex-col gap-1">
            {stats.latestIssue ? (
              <>
                <p className="text-[32px] font-black leading-none">#{stats.latestIssue.issueNumber}</p>
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

// ─── TodaysDraft ─────────────────────────────────────────────────────────────────

function TodaysDraft({ password }: { password: string }) {
  // Draft state
  const [draft, setDraft] = useState<{ id: string; issueNumber: number; issueDate: string; title: string } | null>(null)
  const [articles, setArticles] = useState<DailyArticle[]>([])
  const [draftLoading, setDraftLoading] = useState(true)
  const [draftError, setDraftError] = useState<string | null>(null)

  // Add article form
  const [addUrl, setAddUrl] = useState('')
  const [addAnnotation, setAddAnnotation] = useState('')
  const [addImageUrl, setAddImageUrl] = useState('')
  const [showImageField, setShowImageField] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Publish
  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)

  async function loadDraft() {
    setDraftLoading(true)
    setDraftError(null)
    try {
      const res = await fetch(`/api/today-draft?password=${encodeURIComponent(password)}`)
      if (!res.ok) { setDraftError('Could not load today\'s draft.'); return }
      const data = await res.json()
      setDraft(data.draft ?? null)
      setArticles(data.articles ?? [])
    } catch {
      setDraftError('Network error.')
    } finally {
      setDraftLoading(false)
    }
  }

  useEffect(() => {
    loadDraft()
    // Listen for sibling-panel refresh requests (e.g. BriefingImport after a successful import)
    const handler = () => loadDraft()
    window.addEventListener('aitoday:refresh-draft', handler)
    return () => window.removeEventListener('aitoday:refresh-draft', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddArticle(e: React.FormEvent) {
    e.preventDefault()
    if (!addUrl.trim()) return
    setAddLoading(true)
    setAddError(null)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          url: addUrl.trim(),
          annotation: addAnnotation.trim() || undefined,
          imageUrl: addImageUrl.trim() || undefined,
          autoAnnotate: !addAnnotation.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? `Error ${res.status}`)
        return
      }
      // Reset form and reload draft
      setAddUrl('')
      setAddAnnotation('')
      setAddImageUrl('')
      setShowImageField(false)
      await loadDraft()
    } catch {
      setAddError('Network error — check your connection.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handlePublishNow() {
    if (!draft) return
    setPublishing(true)
    setPublishMessage(null)
    try {
      const res = await fetch('/api/publish-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: draft.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPublishMessage(`Error: ${data.error ?? res.status}`)
        return
      }
      setPublishMessage(`✓ Issue #${draft.issueNumber} published — live on the public site.`)
      await loadDraft()
    } catch {
      setPublishMessage('Network error. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  const notionUrl = draft ? `https://notion.so/${draft.id.replace(/-/g, '')}` : null

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today's issue</p>
        <button
          type="button"
          onClick={loadDraft}
          disabled={draftLoading}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          {draftLoading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {draftError && <p className="text-[14px] font-bold text-ws-accent">{draftError}</p>}

      {/* Draft status */}
      {!draftLoading && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {draft ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[28px] font-black leading-none">{articles.length}</span>
                <span className="text-[14px] font-bold text-ws-black/70">
                  article{articles.length !== 1 ? 's' : ''} captured today
                </span>
                {notionUrl && (
                  <a
                    href={notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-ws-accent underline hover:no-underline font-bold"
                  >
                    Open in Notion ↗
                  </a>
                )}
              </div>
            ) : (
              <p className="text-[14px] text-ws-black/70">No draft yet — add an article below to start today's issue.</p>
            )}
          </div>

          {draft && articles.length > 0 && (
            <button
              type="button"
              onClick={handlePublishNow}
              disabled={publishing}
              className="border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {publishing ? 'Publishing…' : 'Publish now'}
            </button>
          )}
        </div>
      )}

      {publishMessage && (
        <p className="text-[14px] font-bold text-ws-black">{publishMessage}</p>
      )}

      {/* Article list */}
      {articles.length > 0 && (
        <ul className="flex flex-col divide-y divide-ws-black/10 border-[2px] border-ws-black/20">
          {articles.map((a, i) => (
            <li key={i} className="flex gap-3 px-3 py-3">
              {a.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.imageUrl}
                  alt=""
                  className="w-14 h-14 object-cover shrink-0 border border-ws-black/20"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[14px] font-bold truncate">{a.title ?? '(untitled)'}</p>
                {a.annotation && (
                  <p className="text-[13px] text-ws-black/70 line-clamp-2">{a.annotation}</p>
                )}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-ws-black/50 underline hover:no-underline truncate"
                  >
                    {a.url}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add article form */}
      <div className="border-t-[2px] border-ws-black/20 pt-5">
        <p className="text-[12px] font-black uppercase tracking-[0.12em] mb-4">Add article</p>
        <form onSubmit={handleAddArticle} noValidate className="flex flex-col gap-4">
          {/* URL */}
          <div>
            <label htmlFor="today-url" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
              URL <span className="text-ws-accent" aria-hidden="true">*</span>
            </label>
            <input
              id="today-url"
              type="url"
              required
              value={addUrl}
              onChange={e => setAddUrl(e.target.value)}
              placeholder="https://…"
              disabled={addLoading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
            />
          </div>

          {/* Annotation */}
          <div>
            <label htmlFor="today-note" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
              Note <span className="text-ws-muted font-normal normal-case tracking-normal">(optional — blank = AI annotation)</span>
            </label>
            <textarea
              id="today-note"
              value={addAnnotation}
              onChange={e => setAddAnnotation(e.target.value)}
              placeholder="Add a note… or leave blank for AI annotation"
              rows={2}
              disabled={addLoading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] leading-[1.5] resize-y outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            />
          </div>

          {/* Image URL (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowImageField(v => !v)}
              className="text-[12px] font-black uppercase tracking-[0.1em] text-ws-accent hover:text-ws-accent-hover flex items-center gap-1"
              aria-expanded={showImageField}
            >
              <span aria-hidden="true">{showImageField ? '−' : '+'}</span>
              {showImageField ? 'Hide image URL' : 'Add image URL'}
            </button>
            {showImageField && (
              <div className="mt-2">
                <input
                  type="url"
                  value={addImageUrl}
                  onChange={e => setAddImageUrl(e.target.value)}
                  placeholder="https://… (overrides auto-fetched og:image)"
                  disabled={addLoading}
                  className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
                />
                {addImageUrl && (
                  <div className="mt-2 border-[2px] border-ws-black overflow-hidden w-32">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={addImageUrl}
                      alt="Preview"
                      className="w-32 h-20 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {addError && (
            <div role="alert" className="border-[3px] border-ws-black bg-red-50 px-3 py-2 text-[14px] font-bold text-red-700">
              {addError}
            </div>
          )}

          <button
            type="submit"
            disabled={addLoading || !addUrl.trim()}
            className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {addLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Adding…
              </>
            ) : (
              '+ Add to today\'s issue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── BriefingImport ──────────────────────────────────────────────────────────────

interface BriefingArticle {
  title: string
  summary: string
  urls: string[]
  rawText: string
}

interface BriefingSection {
  name: string
  articles: BriefingArticle[]
}

interface BriefingSourceData {
  sourceLabel: string
  sourceId: string
  briefingPageId: string | null
  briefingTitle: string | null
  briefing: { flaggedTopics: string[]; sections: BriefingSection[] } | null
  error?: string
}

interface BriefingApiResponse {
  date: string
  configured: boolean
  sources: BriefingSourceData[]
}

// Stable selection key per article — sourceId + sectionName + first URL
function articleKey(sourceId: string, sectionName: string, article: BriefingArticle): string {
  return `${sourceId}::${sectionName}::${article.urls[0] ?? article.title}`
}

function BriefingImport({ password }: { password: string }) {
  const [data, setData] = useState<BriefingApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rewriteWithAi, setRewriteWithAi] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/briefing-sources?password=${encodeURIComponent(password)}`)
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const payload = (await res.json()) as BriefingApiResponse
      setData(payload)
      // Pre-check every article by default — user unchecks what they don't want
      const initial = new Set<string>()
      for (const source of payload.sources) {
        if (!source.briefing) continue
        for (const section of source.briefing.sections) {
          for (const a of section.articles) {
            initial.add(articleKey(source.sourceId, section.name, a))
          }
        }
      }
      setSelected(initial)
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllInSection(source: BriefingSourceData, section: BriefingSection, on: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const a of section.articles) {
        const k = articleKey(source.sourceId, section.name, a)
        if (on) next.add(k); else next.delete(k)
      }
      return next
    })
  }

  async function handleImport() {
    if (!data || selected.size === 0) return
    setImporting(true)
    setMessage(null)
    setError(null)

    // Collect selected articles in document order
    const toImport: { title: string; summary: string; url: string }[] = []
    for (const source of data.sources) {
      if (!source.briefing) continue
      for (const section of source.briefing.sections) {
        for (const a of section.articles) {
          const k = articleKey(source.sourceId, section.name, a)
          if (selected.has(k) && a.urls[0]) {
            toImport.push({ title: a.title, summary: a.summary, url: a.urls[0] })
          }
        }
      }
    }

    if (toImport.length === 0) {
      setError('No selected articles had a usable URL.')
      setImporting(false)
      return
    }

    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, articles: toImport, rewriteWithAi }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      const failed = (payload.results ?? []).filter((r: { ok: boolean }) => !r.ok).length
      setMessage(
        failed > 0
          ? `✓ Imported ${payload.added} of ${payload.attempted} (${failed} failed). Today's draft now has ${payload.articleCount} article${payload.articleCount === 1 ? '' : 's'}.`
          : `✓ Imported ${payload.added} article${payload.added === 1 ? '' : 's'}. Today's draft now has ${payload.articleCount}.`,
      )
      // Tell TodaysDraft to refresh
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      // Clear selection so user doesn't accidentally double-import
      setSelected(new Set())
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  // Hide entire panel if user hasn't configured any sources — no need for clutter
  if (data && data.configured === false) return null

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">
          Import from briefing
          {data?.date && <span className="ml-2 text-ws-black/50">({data.date})</span>}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}

      {loading && !data && <p className="text-[14px] text-ws-black/70">Loading briefings…</p>}

      {data?.sources.map(source => (
        <div key={source.sourceId} className="border-[2px] border-ws-black/30 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[15px] font-black uppercase tracking-wide">{source.sourceLabel}</p>
            {source.briefingPageId && (
              <a
                href={`https://notion.so/${source.briefingPageId.replace(/-/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-ws-accent underline hover:no-underline font-bold"
              >
                Open briefing in Notion ↗
              </a>
            )}
          </div>

          {source.error && <p className="text-[13px] font-bold text-ws-accent">⚠ {source.error}</p>}

          {!source.briefing && !source.error && (
            <p className="text-[13px] text-ws-black/70">No briefing found for {data.date}.</p>
          )}

          {source.briefing && (
            <>
              {source.briefing.flaggedTopics.length > 0 && (
                <div className="border-l-[3px] border-ws-accent pl-3 py-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent/80 mb-1">
                    🚩 Flagged today
                  </p>
                  <ul className="text-[13px] text-ws-black/80 list-none p-0 m-0 flex flex-col gap-0.5">
                    {source.briefing.flaggedTopics.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {source.briefing.sections.length === 0 && (
                <p className="text-[13px] text-ws-black/70">No importable articles in this briefing.</p>
              )}

              {source.briefing.sections.map(section => {
                const allKeys = section.articles.map(a => articleKey(source.sourceId, section.name, a))
                const allChecked = allKeys.length > 0 && allKeys.every(k => selected.has(k))
                return (
                  <div key={section.name} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[13px] font-black uppercase tracking-[0.1em]">{section.name}</p>
                      <button
                        type="button"
                        onClick={() => toggleAllInSection(source, section, !allChecked)}
                        className="text-[11px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
                      >
                        {allChecked ? 'Uncheck all' : 'Check all'}
                      </button>
                    </div>
                    <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                      {section.articles.map(a => {
                        const k = articleKey(source.sourceId, section.name, a)
                        const checked = selected.has(k)
                        const hostname = a.urls[0] ? new URL(a.urls[0]).hostname.replace(/^www\./, '') : ''
                        return (
                          <li key={k} className="flex gap-3 items-start border border-ws-black/10 px-2 py-2 bg-ws-page/50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(k)}
                              className="mt-1 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
                              aria-label={`Include ${a.title}`}
                            />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <p className="text-[14px] font-bold leading-tight">{a.title}</p>
                              {a.summary && (
                                <p className="text-[12px] text-ws-black/70 line-clamp-2 leading-snug">{a.summary}</p>
                              )}
                              {hostname && (
                                <a
                                  href={a.urls[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-ws-black/50 underline hover:no-underline truncate"
                                >
                                  {hostname}
                                  {a.urls.length > 1 && <span className="ml-2">+{a.urls.length - 1} more</span>}
                                </a>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </>
          )}
        </div>
      ))}

      {data && data.sources.some(s => s.briefing) && (
        <div className="pt-3 border-t-[2px] border-ws-black/10 flex flex-col gap-3">
          {/* AI rewrite toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rewriteWithAi}
              onChange={e => setRewriteWithAi(e.target.checked)}
              disabled={importing}
              className="mt-0.5 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold leading-tight">
                Rewrite annotations with AI (in the AI Today voice)
              </span>
              <span className="text-[12px] text-ws-black/60 leading-snug">
                Each article re-fetched and re-summarised by GPT — same as pasting a URL manually.
                Slower (~2–3 sec per article) but consistent voice. Off = use the briefing's text as-is.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-ws-black/70">{selected.size} selected</p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing
                ? rewriteWithAi
                  ? `…Importing ${selected.size} (AI rewriting)`
                  : '…Importing'
                : `+ Import ${selected.size} into today's draft`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── GenerateEmailFromPublished ──────────────────────────────────────────────────

function GenerateEmailFromPublished({ password }: { password: string }) {
  const [issues, setIssues] = useState<PublishedIssue[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)
  const [open, setOpen] = useState(false)

  async function loadIssues() {
    setLoading(true)
    try {
      const res = await fetch(`/api/published-issues?password=${encodeURIComponent(password)}`)
      if (!res.ok) return
      const data = await res.json()
      const list = (data.issues ?? []) as PublishedIssue[]
      setIssues(list)
      if (list.length > 0) setSelectedId(list[0].id)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function handleOpen() {
    setOpen(true)
    if (!issues) loadIssues()
  }

  async function handleGenerate() {
    const issue = issues?.find(i => i.id === selectedId)
    if (!issue) return
    setEmailLoading(true)
    setEmailDraft(null)
    setEmailError(null)
    try {
      const summariesRes = await fetch(
        `/api/issue-summaries?password=${encodeURIComponent(password)}&pageId=${encodeURIComponent(issue.id)}`
      )
      if (!summariesRes.ok) throw new Error('Could not load issue content from Notion.')
      const { summaries, issueNumber } = await summariesRes.json()

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
      const issueUrl = issue.issueDate ? `${baseUrl}/issues/${issue.issueDate}` : undefined
      const emailRes = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, summaries, issueNumber: issueNumber || issue.issueNumber, issueUrl }),
      })
      const data = await emailRes.json()
      if (data.error) throw new Error(data.error)
      setEmailDraft(data)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to generate email.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleCopy() {
    if (!emailDraft) return
    try {
      await navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  if (!open) {
    return (
      <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Generate email from published issue</p>
          <button
            type="button"
            onClick={handleOpen}
            className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent"
          >
            ✉️ Generate email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Generate email from published issue</p>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent">
          Hide
        </button>
      </div>

      {loading && <p className="text-[14px] text-ws-black/70">Loading issues…</p>}

      {issues && issues.length === 0 && (
        <p className="text-[14px] text-ws-black/70">No published issues found.</p>
      )}

      {issues && issues.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setEmailDraft(null); setEmailError(null) }}
            className="flex-1 border-[3px] border-ws-black px-3 py-2 text-[14px] font-bold bg-ws-white focus-visible:outline-none focus-visible:border-ws-accent"
          >
            {issues.map(i => (
              <option key={i.id} value={i.id}>
                Issue #{i.issueNumber} — {i.issueDate}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={emailLoading || !selectedId}
            className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {emailLoading ? '…Generating' : '✉️ Generate'}
          </button>
        </div>
      )}

      {emailError && <p className="text-[13px] font-bold text-ws-accent">{emailError}</p>}

      {emailDraft && (
        <div className="border-[2px] border-ws-black bg-ws-white flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b-[2px] border-ws-black px-4 py-2">
            <p className="text-[12px] font-black uppercase tracking-[0.15em]">Generated email</p>
            <button type="button" onClick={handleCopy}
              className="text-[12px] font-black uppercase tracking-wide border-[2px] border-ws-black px-3 py-1 hover:bg-ws-page">
              {emailCopied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="px-4 py-3 flex flex-col gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Subject</p>
              <p className="text-[14px] font-bold">{emailDraft.subject}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Body</p>
              <pre className="text-[13px] font-sans whitespace-pre-wrap leading-relaxed">{emailDraft.body}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PublishDrafts ───────────────────────────────────────────────────────────────

function PublishDrafts({ password }: { password: string }) {
  const [drafts, setDrafts] = useState<DraftIssue[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [justPublished, setJustPublished] = useState<DraftIssue | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailCopied, setEmailCopied] = useState(false)

  async function loadDrafts() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/draft-issues?password=${encodeURIComponent(password)}`)
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const data = await res.json()
      setDrafts((data.issues ?? []) as DraftIssue[])
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrafts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefreshSite() {
    setRefreshing(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      setMessage('✓ Public site refreshed.')
      setTimeout(() => setMessage(null), 4000)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleArchive(pageId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? It will be moved to the Notion trash.`)) return
    setArchiving(pageId)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/archive-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Error ${res.status}`)
        return
      }
      setMessage(`✓ Deleted "${title}". Restorable from Notion trash if needed.`)
      setTimeout(() => setMessage(null), 5000)
      loadDrafts()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setArchiving(null)
    }
  }

  async function handlePublish(draft: DraftIssue) {
    setPublishing(draft.id)
    setError(null)
    setMessage(null)
    setJustPublished(null)
    setEmailDraft(null)
    setEmailError(null)
    try {
      const res = await fetch('/api/publish-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: draft.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Error ${res.status}`)
        return
      }
      setMessage(`✓ Published "${draft.title}" — live on the public site.`)
      setTimeout(() => setMessage(null), 8000)
      setJustPublished(draft)
      loadDrafts()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setPublishing(null)
    }
  }

  async function handleGenerateEmail() {
    if (!justPublished) return
    setEmailLoading(true)
    setEmailDraft(null)
    setEmailError(null)
    try {
      const summariesRes = await fetch(
        `/api/issue-summaries?password=${encodeURIComponent(password)}&pageId=${encodeURIComponent(justPublished.id)}`
      )
      if (!summariesRes.ok) throw new Error('Could not load issue content from Notion.')
      const { summaries, issueNumber, issueDate } = await summariesRes.json()

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
      const issueUrl = issueDate ? `${baseUrl}/issues/${issueDate}` : undefined
      const emailRes = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, summaries, issueNumber: issueNumber || justPublished.issueNumber, issueUrl }),
      })
      const data = await emailRes.json()
      if (data.error) throw new Error(data.error)
      setEmailDraft(data)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to generate email.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function handleCopyEmail() {
    if (!emailDraft) return
    try {
      await navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Drafts ready to publish</p>
        <button
          type="button"
          onClick={loadDrafts}
          disabled={loading}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          {loading ? '↻ Loading…' : '↻ Refresh list'}
        </button>
      </div>

      {message && <p className="text-[14px] font-bold text-ws-black mb-3">{message}</p>}
      {error && <p className="text-[14px] font-bold text-ws-accent mb-3">{error}</p>}

      {loading && !drafts ? (
        <p className="text-[14px] text-ws-black/70">Loading drafts…</p>
      ) : drafts && drafts.length === 0 ? (
        <p className="text-[14px] text-ws-black/70">
          No unpublished drafts. Add articles above to start today's issue.
        </p>
      ) : drafts && drafts.length > 0 ? (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {drafts.map(draft => {
            const notionUrl = `https://notion.so/${draft.id.replace(/-/g, '')}`
            return (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 flex-wrap border-[2px] border-ws-black/30 px-3 py-2 hover:bg-ws-page"
              >
                <a
                  href={notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 no-underline group"
                  title="Open draft in Notion"
                >
                  <p className="text-[14px] font-bold truncate group-hover:text-ws-accent group-hover:underline">
                    {draft.title} ↗
                  </p>
                  <p className="text-[12px] text-ws-black/70 uppercase tracking-wide">
                    Issue {draft.issueNumber} · {draft.issueDate}
                  </p>
                </a>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleArchive(draft.id, draft.title)}
                    disabled={publishing !== null || archiving !== null}
                    className="border-[2px] border-ws-black bg-ws-white text-ws-black font-bold uppercase tracking-wide text-[12px] px-2 py-1.5 hover:bg-ws-page disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move to Notion trash"
                  >
                    {archiving === draft.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePublish(draft)}
                    disabled={publishing !== null || archiving !== null}
                    className="border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[13px] px-3 py-1.5 shadow-[3px_3px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishing === draft.id ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {justPublished && (
        <div className="mt-4 border-[3px] border-ws-black bg-ws-page p-4 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[13px] font-black uppercase tracking-[0.12em]">
              Issue #{justPublished.issueNumber} published — generate highlights email?
            </p>
            <button
              type="button"
              onClick={handleGenerateEmail}
              disabled={emailLoading}
              className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailLoading ? '…Generating' : '✉️ Generate email'}
            </button>
          </div>

          {emailError && <p className="text-[13px] font-bold text-ws-accent">{emailError}</p>}

          {emailDraft && (
            <div className="border-[2px] border-ws-black bg-ws-white flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b-[2px] border-ws-black px-4 py-2">
                <p className="text-[12px] font-black uppercase tracking-[0.15em]">Generated email</p>
                <button type="button" onClick={handleCopyEmail}
                  className="text-[12px] font-black uppercase tracking-wide border-[2px] border-ws-black px-3 py-1 hover:bg-ws-page">
                  {emailCopied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Subject</p>
                  <p className="text-[14px] font-bold">{emailDraft.subject}</p>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Body</p>
                  <pre className="text-[13px] font-sans whitespace-pre-wrap leading-relaxed">{emailDraft.body}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t-[2px] border-ws-black/20 flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] text-ws-black/70">Edited a typo on an already-published issue?</p>
        <button
          type="button"
          onClick={handleRefreshSite}
          disabled={refreshing}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          {refreshing ? '↻ Refreshing…' : '↻ Refresh public site'}
        </button>
      </div>
    </div>
  )
}

// ─── CaptureSettings ─────────────────────────────────────────────────────────────

function CaptureSettings() {
  const [open, setOpen] = useState(false)
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false)

  // Build the bookmarklet using the current origin so it works on any domain
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const bookmarkletCode = `javascript:(function(){window.open('${origin}/capture?url='+encodeURIComponent(location.href),'capture','width=520,height=640')})()`

  async function handleCopyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarkletCode)
      setBookmarkletCopied(true)
      setTimeout(() => setBookmarkletCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-page"
      >
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Capture setup</p>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70">
          {open ? '− Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-6 border-t-[2px] border-ws-black/20 pt-5">
          {/* Bookmarklet */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">Browser bookmarklet</p>
            <p className="text-[13px] text-ws-black/70">
              Drag this link to your bookmarks bar. Click it on any page to open the capture form pre-filled with the URL.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Draggable bookmarklet link */}
              <a
                href={bookmarkletCode}
                onClick={e => e.preventDefault()}
                draggable
                className="border-[3px] border-ws-black bg-ws-accent-light text-ws-black font-black text-[14px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-black)] cursor-grab select-none hover:bg-ws-page"
              >
                📌 Capture to AI Today
              </a>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="text-[13px] font-bold uppercase tracking-wide border-[2px] border-ws-black px-3 py-2 hover:bg-ws-page"
              >
                {bookmarkletCopied ? '✓ Copied!' : '📋 Copy code'}
              </button>
            </div>
            <details className="text-[12px]">
              <summary className="cursor-pointer text-ws-black/70 hover:text-ws-black font-bold uppercase tracking-wide">
                Show raw code
              </summary>
              <pre className="mt-2 p-3 bg-ws-page border border-ws-black/20 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {bookmarkletCode}
              </pre>
            </details>
          </div>

          {/* iOS Shortcut */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">iOS Shortcut (background capture)</p>
            <p className="text-[13px] text-ws-black/70">
              Create a Share Sheet shortcut in the iOS Shortcuts app to capture directly from Safari without opening a form.
            </p>
            <ol className="flex flex-col gap-2 text-[13px] pl-5 list-decimal">
              <li>Open <strong>Shortcuts</strong> → New shortcut → <strong>Add action</strong></li>
              <li>Search for <strong>"Get URLs from Input"</strong> — enable <em>Show in Share Sheet</em></li>
              <li>Add action: <strong>"Get Contents of URL"</strong></li>
              <li>
                Set URL to <code className="font-mono bg-ws-page px-1">{origin}/api/capture</code>
              </li>
              <li>Method: <strong>POST</strong> · Request body: <strong>JSON</strong></li>
              <li>
                Add fields:<br />
                <code className="font-mono bg-ws-page px-1 text-[12px]">token</code> → your <code className="font-mono bg-ws-page px-1 text-[12px]">CAPTURE_TOKEN</code> value<br />
                <code className="font-mono bg-ws-page px-1 text-[12px]">url</code> → <em>URLs</em> (from step 1)<br />
                <code className="font-mono bg-ws-page px-1 text-[12px]">autoAnnotate</code> → <code className="font-mono bg-ws-page px-1 text-[12px]">true</code>
              </li>
              <li>Optional: add <strong>"Show Result"</strong> to display the returned article title</li>
            </ol>
            <p className="text-[12px] text-ws-black/50">
              The <code className="font-mono bg-ws-page px-1">CAPTURE_TOKEN</code> is set in your Vercel environment variables. Check <strong>Settings → Environment Variables</strong> in your Vercel project.
            </p>
          </div>

          {/* Mobile web */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">Mobile web form</p>
            <p className="text-[13px] text-ws-black/70">
              Open <a href="/capture" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline font-bold">{origin}/capture</a> on any device. Your capture token is stored in the browser's local storage after first login.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  // ── Auth
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  // ── Document title
  useEffect(() => {
    document.title = authed ? 'Admin — AI Today' : 'Admin sign in — AI Today'
  }, [authed])

  // ── Restore auth from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (stored) { setPassword(stored); setAuthed(true) }
    else passwordRef.current?.focus()
  }, [])

  // ── Auth handlers
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const res = await fetch(`/api/today-draft?password=${encodeURIComponent(password)}`)
      if (res.status === 401) { setAuthError('Incorrect password.'); setAuthLoading(false); return }
      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    sessionStorage.removeItem('adminAuth')
    setPassword('')
    setAuthed(false)
    setAuthError('')
  }

  // ── Render: sign-in ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="max-w-md">
        <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-3">
          Admin sign in
        </h1>
        <div className="w-16 h-[3px] bg-ws-accent mb-8" aria-hidden="true" />
        <div className="border-[3px] border-ws-black bg-ws-white p-6 shadow-[8px_8px_0_0_var(--color-ws-black)]">
          <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[13px] font-black uppercase tracking-wide">
                Password
              </label>
              <input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={authLoading}
                required
                className="border-[3px] border-ws-black px-3 py-3 text-[17px] font-mono w-full focus-visible:outline-none focus-visible:border-ws-accent disabled:bg-ws-page"
              />
              {authError && (
                <p className="text-[14px] font-bold text-ws-accent" role="alert">{authError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={authLoading || !password}
              className="border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[15px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Render: main admin ────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-3">
              Admin
            </h1>
            <div className="w-16 h-[3px] bg-ws-accent" aria-hidden="true" />
          </div>
          <button
            onClick={handleSignOut}
            className="text-[13px] font-black uppercase tracking-wide underline hover:no-underline hover:text-ws-accent mt-4"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Site stats */}
      <SiteStats password={password} />

      {/* Today's draft — capture, preview, publish */}
      <TodaysDraft password={password} />

      {/* Pull articles from configured Notion briefing pages */}
      <BriefingImport password={password} />

      {/* All unpublished drafts — publish or delete */}
      <PublishDrafts password={password} />

      {/* Generate email from any previously published issue */}
      <GenerateEmailFromPublished password={password} />

      {/* Capture setup — bookmarklet, iOS shortcut, mobile web */}
      <CaptureSettings />
    </div>
  )
}
