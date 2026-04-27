'use client'

import { useState, useEffect, useRef } from 'react'
import { categorize, CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import { normalizeUrl } from '@/lib/url-normalize'

// ─── Shared hook: known URLs from recent issues ─────────────────────────────────
// Used by both BriefingImport and ResearchImport to flag and pre-uncheck
// articles whose URL has already been published in the last N days.

function useKnownUrls(password: string, days = 30) {
  const [urls, setUrls] = useState<Set<string>>(new Set())
  const [windowDays, setWindowDays] = useState(days)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/known-urls?password=${encodeURIComponent(password)}&days=${days}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setUrls(new Set<string>(data.urls ?? []))
        setWindowDays(data.windowDays ?? days)
      } catch {
        // Silent — dedup is a nice-to-have, not critical to the import flow
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [password, days])

  // Helper: is this URL already in a recent issue?
  function isKnown(url: string | null | undefined): boolean {
    if (!url) return false
    return urls.has(normalizeUrl(url))
  }

  return { urls, windowDays, loaded, isKnown }
}

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
  const [addCategory, setAddCategory] = useState<Category>('Canada')
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
          category: addCategory,
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
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today&apos;s draft</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Everything imported above lands here. Paste a URL to add anything extra. Click <strong>Publish now</strong> when ready.</p>
        </div>
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
                  article{articles.length !== 1 ? 's' : ''} in today&apos;s draft
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
              <p className="text-[14px] text-ws-black/70">Nothing here yet. Import articles, papers, or events from the panels above — or paste a URL below.</p>
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
        <p className="text-[12px] font-black uppercase tracking-[0.12em] mb-1">Add an article manually</p>
        <p className="text-[12px] text-ws-black/50 mb-4">Paste any URL. Leave the note blank and AI writes the summary for you.</p>
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
              Your note <span className="text-ws-muted font-normal normal-case tracking-normal">(optional — leave blank for AI to write it)</span>
            </label>
            <textarea
              id="today-note"
              value={addAnnotation}
              onChange={e => setAddAnnotation(e.target.value)}
              placeholder="Leave blank and AI writes a summary — or type your own"
              rows={2}
              disabled={addLoading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] leading-[1.5] resize-y outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="today-category" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
              Category <span className="text-ws-muted font-normal normal-case tracking-normal">(which section it goes in)</span>
            </label>
            <select
              id="today-category"
              value={addCategory}
              onChange={e => setAddCategory(e.target.value as Category)}
              disabled={addLoading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            >
              {CATEGORY_ORDER.map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>
              ))}
            </select>
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

// ─── AddEvent ────────────────────────────────────────────────────────────────────
// Form for adding a learning event (webinar, course, conference, meetup) to
// today's draft. Events are stored under a fixed "## Upcoming" h2 section.

function AddEvent({ password }: { password: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Auto-fill from URL
  const [autofillUrl, setAutofillUrl] = useState('')
  const [autofilling, setAutofilling] = useState(false)
  const [autofillError, setAutofillError] = useState<string | null>(null)

  async function handleAutofill() {
    const trimmed = autofillUrl.trim()
    if (!trimmed.startsWith('http')) { setAutofillError('Paste a full URL starting with https://'); return }
    setAutofilling(true)
    setAutofillError(null)
    try {
      const res = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) { setAutofillError(data.error ?? `Error ${res.status}`); return }
      const ev = data.event
      if (ev.title) setTitle(ev.title)
      if (ev.when) setWhen(ev.when)
      if (ev.where) setWhere(ev.where)
      if (ev.description) setDescription(ev.description)
      // Pre-fill the registration URL with the same URL
      if (!url) setUrl(trimmed)
    } catch {
      setAutofillError('Network error.')
    } finally {
      setAutofilling(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!title.trim()) { setError('Event title is required.'); return }
    if (!url.trim() || !url.trim().startsWith('http')) { setError('A valid registration URL is required.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/capture-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          title: title.trim(),
          when: when.trim(),
          where: where.trim(),
          description: description.trim(),
          url: url.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? `Error ${res.status}`); return }
      setSuccess(`✓ Event added to today's draft (under "Upcoming").`)
      // Reset form
      setTitle(''); setWhen(''); setWhere(''); setDescription(''); setUrl('')
      // Tell TodaysDraft to refresh
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div className="border-[3px] border-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-page"
        >
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add a learning event</p>
            <p className="text-[12px] text-ws-black/50 mt-0.5">Webinar, course, conference, meetup. Goes under the &ldquo;Upcoming&rdquo; section in today&apos;s issue.</p>
          </div>
          <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">+ Show</span>
        </button>
      </div>
    )
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add a learning event</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Webinar, course, conference, meetup. Goes under the &ldquo;Upcoming&rdquo; section in today&apos;s issue.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent shrink-0"
        >
          Hide
        </button>
      </div>

      {/* ── Auto-fill from URL ─────────────────────────────────────────── */}
      <div className="border-[2px] border-ws-black/20 bg-ws-page p-4 flex flex-col gap-3">
        <p className="text-[12px] font-black uppercase tracking-[0.1em]">
          Auto-fill from event URL
        </p>
        <p className="text-[12px] text-ws-black/60">
          Paste the event or registration page URL — AI will extract the title, date, location, and description for you.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="url"
            value={autofillUrl}
            onChange={e => setAutofillUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAutofill() } }}
            placeholder="https://…"
            disabled={autofilling}
            className="flex-1 min-w-0 border-[2px] border-ws-black bg-ws-white px-3 py-2 text-[14px] font-mono outline-none focus-visible:border-ws-accent disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleAutofill}
            disabled={autofilling || !autofillUrl.trim()}
            className="border-[2px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[12px] px-4 py-2 hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 transition-colors"
          >
            {autofilling ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Extracting…
              </>
            ) : '✦ Auto-fill'}
          </button>
        </div>
        {autofillError && (
          <p className="text-[13px] font-bold text-ws-accent">{autofillError}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="event-title" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Event title <span className="text-ws-accent" aria-hidden="true">*</span>
          </label>
          <input
            id="event-title"
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. AI for Public Sector Leaders"
            disabled={loading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event-when" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
              When
            </label>
            <input
              id="event-when"
              type="text"
              value={when}
              onChange={e => setWhen(e.target.value)}
              placeholder="e.g. May 7, 2pm ET"
              disabled={loading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="event-where" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
              Where
            </label>
            <input
              id="event-where"
              type="text"
              value={where}
              onChange={e => setWhere(e.target.value)}
              placeholder="e.g. Virtual, Toronto, Hybrid…"
              disabled={loading}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="event-desc" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Description <span className="text-ws-muted font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="event-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What it&apos;s about, who it&apos;s for, why someone should attend…"
            rows={2}
            disabled={loading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] leading-[1.5] resize-y outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="event-url" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Registration URL <span className="text-ws-accent" aria-hidden="true">*</span>
          </label>
          <input
            id="event-url"
            type="url"
            required
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://…"
            disabled={loading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
          />
        </div>

        {error && (
          <div role="alert" className="border-[3px] border-ws-black bg-red-50 px-3 py-2 text-[14px] font-bold text-red-700">
            {error}
          </div>
        )}
        {success && (
          <p className="text-[14px] font-bold text-ws-black">{success}</p>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim() || !url.trim()}
          className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Adding event…
            </>
          ) : (
            '+ Add event to today\'s issue'
          )}
        </button>
      </form>
    </div>
  )
}

// ─── ResearchImport ──────────────────────────────────────────────────────────────
// Fetches today's AI research papers from the Notion "AI Research Papers" database
// and lets the editor import selected papers into today's draft under ## Research.

interface ResearchPaperItem {
  id: string
  title: string
  summary: string | null
  keyFindings: string | null
  url: string | null
  hfUrl: string | null
  area: string[]
  authors: string | null
  source: string | null
  arXivId: string | null
  date: string | null
}

interface ResearchApiResponse {
  papers: ResearchPaperItem[]
  date: string
  configured: boolean
  error?: string
}

const NOTION_RESEARCH_DB_URL = 'https://www.notion.so/ce3aae7fc2b743869113af0425febe68'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function ResearchImport({ password }: { password: string }) {
  const [data, setData] = useState<ResearchApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const { isKnown, windowDays } = useKnownUrls(password)

  // Always read from the DOM ref so we get the real current value regardless
  // of whether the native date-picker popup triggered a React onChange event.
  function currentDate(): string {
    return dateInputRef.current?.value || todayIso()
  }

  async function load(targetDate = currentDate()) {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const params = new URLSearchParams({ password, date: targetDate })
      const res = await fetch(`/api/research-papers?${params}`)
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const payload = (await res.json()) as ResearchApiResponse
      setData(payload)
      // Pre-check every paper EXCEPT ones already in a recent issue
      setSelected(new Set(payload.papers.filter(p => !isKnown(p.url)).map(p => p.id)))
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

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (!data || selected.size === 0) return
    setImporting(true)
    setMessage(null)
    setError(null)

    const toImport = data.papers
      .filter(p => selected.has(p.id) && p.url)
      .map(p => ({
        title: p.title,
        summary: p.summary ?? p.keyFindings ?? '[Add annotation]',
        url: p.url as string,
        imageUrl: null,
        category: 'Research' as Category,
      }))

    if (toImport.length === 0) {
      setError('No selected papers had a usable URL.')
      setImporting(false)
      return
    }

    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, articles: toImport }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      const failed = (payload.results ?? []).filter((r: { ok: boolean }) => !r.ok).length
      setMessage(
        failed > 0
          ? `✓ Imported ${payload.added} of ${payload.attempted} (${failed} failed). Draft now has ${payload.articleCount} items.`
          : `✓ Imported ${payload.added} paper${payload.added === 1 ? '' : 's'}. Draft now has ${payload.articleCount} items.`,
      )
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      setSelected(new Set())
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  // Hide if env var not configured
  if (data && data.configured === false) return null

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">
            🔬 Import research papers
          </p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">
            Trending AI papers from arXiv and Hugging Face, pulled from your Notion research database.
            Pre-checked — uncheck anything you don&apos;t want.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <a
            href={NOTION_RESEARCH_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-ws-accent underline hover:no-underline font-bold"
          >
            Open in Notion ↗
          </a>
          <button
            type="button"
            onClick={() => load(currentDate())}
            disabled={loading}
            className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Date picker — lets you load papers from any day, not just today */}
      <div className="flex items-center gap-2">
        <label htmlFor="research-date" className="text-[12px] font-black uppercase tracking-[0.1em] shrink-0">
          Date
        </label>
        <input
          ref={dateInputRef}
          id="research-date"
          type="date"
          defaultValue={todayIso()}
          className="border-[2px] border-ws-black px-2 py-1 text-[13px] font-mono outline-none focus-visible:border-ws-accent"
        />
        <button
          type="button"
          onClick={() => load(currentDate())}
          disabled={loading}
          className="border-[2px] border-ws-black bg-ws-page px-3 py-1 text-[12px] font-black uppercase tracking-wide hover:bg-ws-black hover:text-ws-white disabled:opacity-50 transition-colors"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => {
            const t = todayIso()
            if (dateInputRef.current) dateInputRef.current.value = t
            load(t)
          }}
          disabled={loading}
          className="text-[12px] text-ws-black/50 underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          Today
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}

      {loading && !data && <p className="text-[14px] text-ws-black/70">Loading research papers…</p>}

      {data && !loading && data.papers.length === 0 && (
        <div className="border border-ws-black/15 px-4 py-5 text-center flex flex-col gap-2">
          <p className="text-[14px] font-black uppercase tracking-wide">No papers for {data.date} yet</p>
          <p className="text-[13px] text-ws-black/60">
            Papers will appear here once they&apos;re added to the Notion database with today&apos;s date.
          </p>
          <a
            href={NOTION_RESEARCH_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-ws-accent underline hover:no-underline font-bold"
          >
            Open research database in Notion ↗
          </a>
        </div>
      )}

      {data && data.papers.length > 0 && (
        <>
          {/* Select-all / deselect-all */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set(data.papers.map(p => p.id)))}
              className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
            >
              Select all
            </button>
            <span className="text-ws-black/30">·</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
            >
              Deselect all
            </button>
            <span className="text-ws-black/50 text-[12px] ml-auto">{selected.size} of {data.papers.length} selected</span>
          </div>

          {/* Duplicate banner */}
          {(() => {
            const dupeCount = data.papers.filter(p => isKnown(p.url)).length
            if (dupeCount === 0) return null
            return (
              <p className="text-[12px] bg-ws-accent-light/30 border border-ws-black/20 px-3 py-2">
                <strong>{dupeCount} paper{dupeCount === 1 ? '' : 's'}</strong> already published in the last {windowDays} days — pre-unchecked. Re-check any you want to include anyway.
              </p>
            )
          })()}

          {/* Paper list */}
          <div className="flex flex-col gap-3">
            {data.papers.map(paper => {
              const checked = selected.has(paper.id)
              const dupe = isKnown(paper.url)
              return (
                <label
                  key={paper.id}
                  className={`flex gap-3 p-3 border-[2px] cursor-pointer transition-colors ${
                    checked ? 'border-ws-black bg-ws-white' : 'border-ws-black/20 bg-ws-page opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(paper.id)}
                    className="mt-1 shrink-0 w-4 h-4 accent-ws-accent"
                  />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-[14px] font-black leading-snug">
                      {paper.title}
                      {dupe && (
                        <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-ws-accent border border-ws-accent px-1.5 py-0.5 align-middle">
                          ⚠ Already published
                        </span>
                      )}
                    </p>

                    {/* Area tags */}
                    {paper.area.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {paper.area.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 border border-ws-black/30 text-ws-black/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Summary / Key Findings */}
                    {(paper.summary || paper.keyFindings) && (
                      <p className="text-[13px] text-ws-black/70 leading-snug line-clamp-3">
                        {paper.summary ?? paper.keyFindings}
                      </p>
                    )}

                    {/* Authors + source link */}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {paper.authors && (
                        <span className="text-[11px] text-ws-black/50 truncate max-w-[260px]">{paper.authors}</span>
                      )}
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-ws-accent underline hover:no-underline font-bold shrink-0"
                        >
                          {paper.arXivId ? `arXiv:${paper.arXivId}` : paper.source ?? 'View paper'} ↗
                        </a>
                      )}
                      {paper.hfUrl && paper.arXivId && (
                        <a
                          href={paper.hfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-ws-black/50 underline hover:no-underline hover:text-ws-accent shrink-0"
                        >
                          HF ↗
                        </a>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Import button */}
          <div className="flex items-center gap-4 flex-wrap border-t border-ws-black/10 pt-4">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Importing…
                </>
              ) : (
                `Import ${selected.size} paper${selected.size === 1 ? '' : 's'} → Research section`
              )}
            </button>
            <p className="text-[12px] text-ws-black/50">Added under <strong>## Research</strong> in today&apos;s draft.</p>
          </div>
        </>
      )}
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
  const { isKnown, windowDays } = useKnownUrls(password)

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
      // Pre-check every article by default — user unchecks what they don't want.
      // Skip articles whose first URL is already in a recent issue (dupe).
      const initial = new Set<string>()
      for (const source of payload.sources) {
        if (!source.briefing) continue
        for (const section of source.briefing.sections) {
          for (const a of section.articles) {
            if (a.urls[0] && isKnown(a.urls[0])) continue
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

  function toggleAllInCategory(entries: { key: string }[], on: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const e of entries) {
        if (on) next.add(e.key); else next.delete(e.key)
      }
      return next
    })
  }

  async function handleImport() {
    if (!data || selected.size === 0) return
    setImporting(true)
    setMessage(null)
    setError(null)

    // Collect selected articles, tagged with their canonical category so the
    // import route can group them under the right h2 section in the draft.
    const toImport: { title: string; summary: string; url: string; category: Category }[] = []
    for (const source of data.sources) {
      if (!source.briefing) continue
      for (const section of source.briefing.sections) {
        const cat = categorize(source.sourceLabel, section.name)
        for (const a of section.articles) {
          const k = articleKey(source.sourceId, section.name, a)
          if (selected.has(k) && a.urls[0]) {
            toImport.push({ title: a.title, summary: a.summary, url: a.urls[0], category: cat })
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">
            Import from briefings
            {data?.date && <span className="ml-2 text-ws-black/50">({data.date})</span>}
          </p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Today&apos;s articles from each connected source, pre-checked. Uncheck anything you don&apos;t want, then click Import.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50 shrink-0"
        >
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}

      {loading && !data && <p className="text-[14px] text-ws-black/70">Loading briefings…</p>}

      {/* Duplicate banner — count articles across all sources whose URL is
          already in a recent issue. Pre-unchecked to avoid re-publishing. */}
      {data && (() => {
        let dupeCount = 0
        for (const source of data.sources) {
          if (!source.briefing) continue
          for (const section of source.briefing.sections) {
            for (const a of section.articles) {
              if (a.urls[0] && isKnown(a.urls[0])) dupeCount++
            }
          }
        }
        if (dupeCount === 0) return null
        return (
          <p className="text-[12px] bg-ws-accent-light/30 border border-ws-black/20 px-3 py-2">
            <strong>{dupeCount} article{dupeCount === 1 ? '' : 's'}</strong> already published in the last {windowDays} days — pre-unchecked. Re-check any you want to include anyway.
          </p>
        )
      })()}

      {/* Source-level chrome: links to Notion, errors, "no briefing yet" notes,
          and flagged-topics callouts. Article lists themselves are categorized
          and rendered below this strip. */}
      {data && data.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.sources.map(source => {
            const articleCount = source.briefing
              ? source.briefing.sections.reduce((n, s) => n + s.articles.length, 0)
              : 0
            return (
              <div
                key={source.sourceId}
                className="flex items-center justify-between gap-3 flex-wrap border border-ws-black/15 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-black uppercase tracking-wide">
                    {source.sourceLabel}
                    {source.briefing && (
                      <span className="ml-2 text-[12px] font-normal normal-case tracking-normal text-ws-black/50">
                        {articleCount} article{articleCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  {source.error && (
                    <p className="text-[12px] font-bold text-ws-accent mt-1">
                      ⚠ Can&apos;t access in Notion — share the page with the &quot;AI This Week Site&quot; integration.
                    </p>
                  )}
                  {!source.briefing && !source.error && (
                    <p className="text-[12px] text-ws-black/60 mt-1">No briefing for {data.date} yet.</p>
                  )}
                </div>
                {source.briefingPageId && (
                  <a
                    href={`https://notion.so/${source.briefingPageId.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-ws-accent underline hover:no-underline font-bold shrink-0"
                  >
                    Open in Notion ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Flagged-topic callouts (still per-source — they're advisory, not articles) */}
      {data?.sources.some(s => s.briefing && s.briefing.flaggedTopics.length > 0) && (
        <div className="border-l-[3px] border-ws-accent pl-3 py-1">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent/80 mb-1">
            🚩 Flagged today
          </p>
          <ul className="text-[13px] text-ws-black/80 list-none p-0 m-0 flex flex-col gap-0.5">
            {data.sources.flatMap(s =>
              s.briefing
                ? s.briefing.flaggedTopics.map((t, i) => (
                    <li key={`${s.sourceId}-${i}`}>
                      • {t} <span className="text-ws-black/40">· {s.sourceLabel}</span>
                    </li>
                  ))
                : []
            )}
          </ul>
        </div>
      )}

      {/* Categorized article view — articles from all sources rolled up into
          5 canonical buckets (Canada / Policy & Regulation / Government /
          Industry & Models / Sectors & Applications). */}
      {data && (() => {
        // Build flat list: every article tagged with its source + section + category
        type Entry = {
          key: string
          category: Category
          article: BriefingArticle
          sourceLabel: string
          sectionName: string
        }
        const entries: Entry[] = []
        for (const source of data.sources) {
          if (!source.briefing) continue
          for (const section of source.briefing.sections) {
            const cat = categorize(source.sourceLabel, section.name)
            for (const a of section.articles) {
              entries.push({
                key: articleKey(source.sourceId, section.name, a),
                category: cat,
                article: a,
                sourceLabel: source.sourceLabel,
                sectionName: section.name,
              })
            }
          }
        }
        if (entries.length === 0) return null

        // Group by category, preserving the canonical display order
        const byCategory = new Map<Category, Entry[]>()
        for (const cat of CATEGORY_ORDER) byCategory.set(cat, [])
        for (const e of entries) byCategory.get(e.category)!.push(e)

        return (
          <div className="flex flex-col gap-5 mt-2">
            {CATEGORY_ORDER.map(cat => {
              const bucket = byCategory.get(cat)!
              if (bucket.length === 0) return null
              const allChecked = bucket.every(e => selected.has(e.key))
              const meta = CATEGORY_META[cat]
              return (
                <div key={cat} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap border-b-[2px] border-ws-black pb-1">
                    <div className="min-w-0">
                      <p className="text-[14px] font-black uppercase tracking-[0.08em]">
                        <span className="mr-1.5" aria-hidden="true">{meta.icon}</span>
                        {cat}
                        <span className="ml-2 text-[12px] font-normal normal-case tracking-normal text-ws-black/50">
                          {bucket.length} article{bucket.length !== 1 ? 's' : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-ws-black/50 mt-0.5">{meta.tagline}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAllInCategory(bucket, !allChecked)}
                      className="text-[11px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent shrink-0"
                    >
                      {allChecked ? 'Uncheck all' : 'Check all'}
                    </button>
                  </div>
                  <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                    {bucket.map(e => {
                      const checked = selected.has(e.key)
                      const dupe = isKnown(e.article.urls[0])
                      const hostname = e.article.urls[0]
                        ? new URL(e.article.urls[0]).hostname.replace(/^www\./, '')
                        : ''
                      return (
                        <li
                          key={e.key}
                          className="flex gap-3 items-start border border-ws-black/10 px-2 py-2 bg-ws-page/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(e.key)}
                            className="mt-1 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
                            aria-label={`Include ${e.article.title}`}
                          />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <p className="text-[14px] font-bold leading-tight">
                              {e.article.title}
                              {dupe && (
                                <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-ws-accent border border-ws-accent px-1.5 py-0.5 align-middle whitespace-nowrap">
                                  ⚠ Already published
                                </span>
                              )}
                            </p>
                            {e.article.summary && (
                              <p className="text-[12px] text-ws-black/70 line-clamp-2 leading-snug">
                                {e.article.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-ws-black/50">
                              {hostname && (
                                <a
                                  href={e.article.urls[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:no-underline truncate"
                                >
                                  {hostname}
                                </a>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="truncate">
                                {e.sourceLabel} / {e.sectionName}
                              </span>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )
      })()}

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
                Rewrite summaries in the AI Today voice
              </span>
              <span className="text-[12px] text-ws-black/60 leading-snug">
                Uses AI to rewrite each briefing summary — same result as pasting a URL manually.
                Slower (~2–3 sec per article). Leave off to use the briefing&apos;s text as-is (fast).
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
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Generate the email</p>
            <p className="text-[12px] text-ws-black/50 mt-0.5">Pick any published issue and generate a newsletter email you can copy into Beehiiv / Mailchimp / your email tool.</p>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent shrink-0"
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
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Generate the email</p>
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
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">All unpublished drafts</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Every unpublished draft, including today&apos;s. Faster to publish today&apos;s from the panel above — this list mostly catches drafts from earlier days you didn&apos;t finish.</p>
        </div>
        <button
          type="button"
          onClick={loadDrafts}
          disabled={loading}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50 shrink-0"
        >
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {message && <p className="text-[14px] font-bold text-ws-black mb-3">{message}</p>}
      {error && <p className="text-[14px] font-bold text-ws-accent mb-3">{error}</p>}

      {loading && !drafts ? (
        <p className="text-[14px] text-ws-black/70">Loading drafts…</p>
      ) : drafts && drafts.length === 0 ? (
        <p className="text-[14px] text-ws-black/70">
          No drafts waiting. Add some articles and they&apos;ll appear here ready to publish.
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
        <p className="text-[12px] text-ws-black/70">Fixed a typo on an already-published issue in Notion?</p>
        <button
          type="button"
          onClick={handleRefreshSite}
          disabled={refreshing}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          {refreshing ? '↻ Refreshing…' : '↻ Force-refresh public site'}
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
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add articles while browsing</p>
          {!open && <p className="text-[12px] text-ws-black/50 mt-0.5">Scan a QR code to capture from your phone, or grab the desktop bookmarklet. Set up once, capture anywhere.</p>}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">
          {open ? '− Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-6 border-t-[2px] border-ws-black/20 pt-5">
          {/* Easiest: mobile capture page + QR code */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">📱 Easiest — on your phone</p>
            <p className="text-[13px] text-ws-black/70">
              Scan the QR code with your phone camera. The capture page opens — paste any article URL and tap Save.
              <br />
              <strong>Pro tip:</strong> in Safari, tap <em>Share</em> → <em>Add to Home Screen</em> for one-tap access from your home screen.
            </p>
            <div className="flex items-start gap-4 flex-wrap">
              {origin && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(`${origin}/capture`)}`}
                  alt="QR code to capture page"
                  width={180}
                  height={180}
                  className="border-[2px] border-ws-black shrink-0"
                />
              )}
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/60">Or open this URL on any device:</p>
                <a
                  href="/capture"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-mono break-all underline hover:no-underline text-ws-accent font-bold"
                >
                  {origin}/capture
                </a>
                <p className="text-[12px] text-ws-black/60 mt-1">
                  No setup, no token, no shortcut to configure. Just paste a URL and Save — same flow as the manual paste box on this page.
                </p>
              </div>
            </div>
          </div>

          {/* Bookmarklet — also easy */}
          <div className="flex flex-col gap-3 border-t border-ws-black/15 pt-5">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">💻 Desktop — one-click bookmarklet</p>
            <p className="text-[13px] text-ws-black/70">
              Drag the button below to your browser&apos;s bookmarks bar. Then while reading any article, click it — done.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
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
          </div>

          {/* iOS Shortcut — hidden behind a disclosure */}
          <details className="border-t border-ws-black/15 pt-4">
            <summary className="cursor-pointer text-[12px] font-black uppercase tracking-[0.1em] text-ws-black/60 hover:text-ws-black select-none">
              ⚙️ Advanced — iOS Share Sheet shortcut (skip this; the QR code above is easier)
            </summary>
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-[13px] text-ws-black/70">
                Set up a one-tap Share Sheet shortcut so you can add any article from Safari without opening a form — just tap Share → the shortcut. <em>Most people don&apos;t need this</em> — the home-screen shortcut from the QR code above is just as fast and requires zero setup.
              </p>
              <ol className="flex flex-col gap-2 text-[13px] pl-5 list-decimal">
                <li>Open <strong>Shortcuts</strong> → New shortcut → <strong>Add action</strong></li>
                <li>Search for <strong>&quot;Get URLs from Input&quot;</strong> — enable <em>Show in Share Sheet</em></li>
                <li>Add action: <strong>&quot;Get Contents of URL&quot;</strong></li>
                <li>Set URL to <code className="font-mono bg-ws-page px-1">{origin}/api/capture</code></li>
                <li>Method: <strong>POST</strong> · Request body: <strong>JSON</strong></li>
                <li>
                  Add fields:<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">token</code> → your <code className="font-mono bg-ws-page px-1 text-[12px]">CAPTURE_TOKEN</code> value<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">url</code> → <em>URLs</em> (from step 1)<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">autoAnnotate</code> → <code className="font-mono bg-ws-page px-1 text-[12px]">true</code>
                </li>
                <li>Optional: add <strong>&quot;Show Result&quot;</strong> to display the returned article title</li>
              </ol>
              <p className="text-[12px] text-ws-black/50">
                The <code className="font-mono bg-ws-page px-1">CAPTURE_TOKEN</code> is set in your Vercel environment variables.
              </p>
              <details className="text-[12px]">
                <summary className="cursor-pointer text-ws-black/70 hover:text-ws-black font-bold uppercase tracking-wide">
                  Show raw bookmarklet code
                </summary>
                <pre className="mt-2 p-3 bg-ws-page border border-ws-black/20 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {bookmarkletCode}
                </pre>
              </details>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

// ─── WorkflowGuide ────────────────────────────────────────────────────────────────
// Plain-language "how this works" panel at the top of the admin page.
// Persists collapsed state in localStorage so daily users aren't bothered by it.

function WorkflowGuide() {
  const [open, setOpen] = useState(true)

  // Restore preference (default open until user dismisses once)
  useEffect(() => {
    const stored = localStorage.getItem('aitoday:workflow-guide-open')
    if (stored === 'closed') setOpen(false)
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('aitoday:workflow-guide-open', next ? 'open' : 'closed')
  }

  return (
    <div className="mt-6 border-[3px] border-ws-black bg-ws-page shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-accent-light/40"
      >
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black">How this works</p>
          {!open && (
            <p className="text-[12px] text-ws-black/60 mt-0.5">
              Import → Publish → Email. Click to expand the full guide (~5 min).
            </p>
          )}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">
          {open ? '− Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t-[2px] border-ws-black/15 flex flex-col gap-5 text-[14px] leading-[1.55]">
          <p className="text-ws-black/80">
            Each morning four Notion sources auto-generate:{' '}
            <strong>Canada AI Daily</strong>, <strong>Agriculture AI</strong>,{' '}
            <strong>Daily News – AI</strong>, and <strong>Trending AI Research</strong>.
            The flow below takes about 5 minutes.
          </p>

          <ol className="flex flex-col gap-4 list-none p-0 m-0">
            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">1</span>
              <div>
                <p className="font-black text-[14px] mb-1">Import today&apos;s content</p>
                <p className="text-ws-black/70">
                  Three panels below feed today&apos;s draft. Each is pre-checked — uncheck anything
                  you don&apos;t want, then click the import button at the bottom of each:
                </p>
                <ul className="text-ws-black/70 list-disc pl-5 mt-1.5 flex flex-col gap-1">
                  <li><strong>Import from briefings</strong> — news articles grouped into 5 categories (Canada · Policy · Government · Industry · Sectors)</li>
                  <li><strong>🔬 Import research papers</strong> — trending arXiv / Hugging Face papers</li>
                  <li><strong>Add a learning event</strong> — paste an event URL and AI auto-fills the title, date, location, and description (you can edit before saving)</li>
                </ul>
                <p className="text-ws-black/60 mt-1.5 text-[13px]">
                  Optional on briefings: <em>Rewrite summaries in the AI Today voice</em> — GPT
                  rewrites each summary. Slower (~2–3 sec/article) but consistent voice.
                </p>
                <p className="text-ws-black/60 mt-1 text-[13px]">
                  Anything already published in the last 30 days shows a <strong>⚠ Already published</strong> badge and is pre-unchecked, so you don&apos;t accidentally repeat yourself.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">2</span>
              <div>
                <p className="font-black text-[14px] mb-1">Review &amp; publish</p>
                <p className="text-ws-black/70">
                  Scroll to <strong>Today&apos;s draft</strong> to see everything you imported. Spotted
                  a great article elsewhere? Paste its URL right there — AI writes the summary.
                  When it looks right, click <strong>Publish now</strong> at the top of that panel.
                  The issue goes live on the public site immediately.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">3</span>
              <div>
                <p className="font-black text-[14px] mb-1">Send the email</p>
                <p className="text-ws-black/70">
                  After publishing, scroll to <strong>Generate the email</strong>. Click
                  <em> Generate</em> — you get a ready-to-paste newsletter. Copy it into Beehiiv /
                  Mailchimp / your email tool of choice.
                </p>
              </div>
            </li>
          </ol>

          <div className="border-t-[1px] border-ws-black/15 pt-3 text-[13px] text-ws-black/60">
            <p>
              <strong>Catching articles on the go?</strong> Open <em>Add articles while browsing</em>{' '}
              at the bottom of this page — scan the QR code with your phone, or grab the desktop bookmarklet.
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

        {/* Plain-language workflow guide */}
        <WorkflowGuide />
      </div>

      {/* Site stats */}
      <SiteStats password={password} />

      {/* ── Step 1: ADD content to today's draft ─────────────────────────────
          All three of these panels feed articles/events into today's draft.
          Grouped together so the user adds everything in one stretch before
          reviewing the assembled draft below. */}
      <BriefingImport password={password} />
      <ResearchImport password={password} />
      <AddEvent password={password} />

      {/* ── Step 2: REVIEW the draft (optionally paste extras) + PUBLISH ──── */}
      <TodaysDraft password={password} />

      {/* ── Step 3: Older unpublished drafts (rarely needed) ───────────────── */}
      <PublishDrafts password={password} />

      {/* Step 4 — Generate email from any previously published issue */}
      <GenerateEmailFromPublished password={password} />

      {/* Capture tools — bookmarklet, iOS shortcut, mobile web */}
      <CaptureSettings />
    </div>
  )
}
