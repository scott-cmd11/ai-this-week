'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SectionSummary {
  url: string
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
  summary: string
}

type SummaryLength = 'brief' | 'standard' | 'detailed'

type ProgressEvent =
  | { type: 'fetch';      section: string; url: string }
  | { type: 'pdf';        section: string; url: string }
  | { type: 'summarise';  section: string; url: string }
  | { type: 'done_url';   section: string; url: string; summary: string }
  | { type: 'notion';     message: string }
  | { type: 'complete';   notionUrl: string; issueNumber?: number; summaries: Record<string, Array<SectionSummary>> }
  | { type: 'error';      message: string }

interface SavedSession {
  savedAt: string
  sections: Record<SectionKey, string>
}

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

type SectionKey = 'top' | 'bright' | 'tool' | 'podcast' | 'learning' | 'deep'

interface CompletedCreate { notionUrl: string; issueNumber: number }

// ─── Constants ──────────────────────────────────────────────────────────────────

const SECTION_KEYS: SectionKey[] = ['top', 'bright', 'tool', 'podcast', 'learning', 'deep']

const SECTION_LABELS: Record<SectionKey, string> = {
  top: 'Top Stories',
  bright: 'Bright Spot',
  tool: 'Tool of the Week',
  podcast: 'Podcast of the Week',
  learning: 'Learning',
  deep: 'Deep Dive',
}

const SECTION_EMAIL_HEADINGS: Record<SectionKey, string> = {
  top: 'TOP STORIES',
  bright: 'BRIGHT SPOT OF THE WEEK',
  tool: 'TOOL OF THE WEEK',
  podcast: 'PODCAST OF THE WEEK',
  learning: 'LEARNING',
  deep: 'DEEP DIVE',
}

const EMPTY_SECTIONS: Record<SectionKey, string> = { top: '', bright: '', tool: '', podcast: '', learning: '', deep: '' }
const ALL_COLLAPSED: Record<SectionKey, boolean> = { top: false, bright: false, tool: false, podcast: false, learning: false, deep: false }
const EMPTY_SUMMARIES: Record<SectionKey, SectionSummary[]> = { top: [], bright: [], tool: [], podcast: [], learning: [], deep: [] }

const SUMMARY_LENGTH_LABELS: Record<SummaryLength, string> = {
  brief: 'Brief (1–2 sentences)',
  standard: 'Standard (2–3 sentences)',
  detailed: 'Detailed (3–4 sentences)',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function nextFriday(): string {
  const today = new Date()
  const day = today.getDay() // 0 = Sun, 1 = Mon, … 5 = Fri, 6 = Sat
  // If today IS Friday, target next week's Friday, not today.
  const daysUntil = day === 5 ? 7 : day < 5 ? 5 - day : 6
  const friday = new Date(today)
  friday.setDate(today.getDate() + daysUntil)
  return friday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatSavedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function urlHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function parseUrlLines(text: string): string[] {
  if (!text.trim()) return []
  return text.split(/\n+/).map(u => u.trim()).filter(u => u.startsWith('http'))
}

function hasSummaryContent(summaries: Record<SectionKey, SectionSummary[]>): boolean {
  return SECTION_KEYS.some(k => (summaries[k]?.length ?? 0) > 0)
}

function formatSummariesAsEmail(summaries: Record<SectionKey, SectionSummary[]>): string {
  const parts: string[] = []
  for (const key of SECTION_KEYS) {
    const items = summaries[key] ?? []
    if (items.length === 0) continue
    const heading = SECTION_EMAIL_HEADINGS[key]
    parts.push(heading)
    parts.push('─'.repeat(heading.length))
    for (const { url, title, publishedDate, summary } of items) {
      parts.push('')
      parts.push(title ? `${title}\n${url}` : url)
      if (publishedDate) parts.push(`Published: ${publishedDate}`)
      parts.push('')
      parts.push(summary)
    }
    parts.push('')
    parts.push('────────────────────────────────────────')
    parts.push('')
  }
  return parts.join('\n').trim()
}

// Smart paste: when pasting mixed text + URLs, extract just the URLs
function applySmartPaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  currentValue: string,
  onChange: (v: string) => void
) {
  const pasted = e.clipboardData.getData('text')
  const lines = pasted.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const urls = lines.filter(l => /^https?:\/\//.test(l))
  if (urls.length > 0 && urls.length < lines.length) {
    e.preventDefault()
    const existing = currentValue.trim()
    onChange(existing ? `${existing}\n${urls.join('\n')}` : urls.join('\n'))
  }
}

// ─── SectionTextarea (with drag-to-reorder list view) ───────────────────────────

function SectionTextarea({
  label, value, onChange, disabled, placeholder, expanded, onToggle,
}: {
  label: string; value: string; onChange: (v: string) => void
  disabled: boolean; placeholder?: string; expanded: boolean; onToggle: () => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showAddMore, setShowAddMore] = useState(false)
  const [addText, setAddText] = useState('')

  const urls = parseUrlLines(value)
  const hasUrls = urls.length > 0

  function handleDragStart(e: React.DragEvent, i: number) {
    setDragIndex(i)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== i) setDragOverIndex(i)
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null); setDragOverIndex(null); return
    }
    const next = [...urls]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next.join('\n'))
    setDragIndex(null); setDragOverIndex(null)
  }

  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null) }

  function removeUrl(index: number) {
    onChange(urls.filter((_, i) => i !== index).join('\n'))
  }

  function moveUrl(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= urls.length) return
    const next = [...urls]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next.join('\n'))
  }

  function handleAddMoreSubmit() {
    const newUrls = parseUrlLines(addText)
    if (newUrls.length === 0) return
    const existing = value.trim()
    onChange(existing ? `${existing}\n${newUrls.join('\n')}` : newUrls.join('\n'))
    setAddText('')
    setShowAddMore(false)
  }

  return (
    <div className={`border-[3px] border-neopop-black bg-neopop-white ${expanded ? 'shadow-[6px_6px_0_0_var(--color-neopop-black)]' : 'shadow-[4px_4px_0_0_var(--color-neopop-black)]'} transition-shadow`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-neopop-cream disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3">
          <span className="font-black uppercase tracking-wide text-[16px] text-ws-black">{label}</span>
          {urls.length > 0 && (
            <span className="text-[12px] font-black uppercase tracking-wide text-neopop-white bg-neopop-red border-[2px] border-neopop-black px-2 py-0.5">
              {urls.length} URL{urls.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[13px] font-black uppercase tracking-wide text-ws-black/70">
          {expanded ? '− Hide' : '＋ Add URL'}
        </span>
      </button>
      <div className={expanded ? 'px-5 pb-5 pt-1 flex flex-col gap-2' : 'hidden'}>
          {hasUrls ? (
            <div className="flex flex-col gap-2">
              {/* Drag-to-reorder list */}
              <div className="border-[2px] border-neopop-black divide-y divide-neopop-black/20">
                {urls.map((url, i) => (
                  <div
                    key={`${i}:${url}`}
                    draggable={!disabled}
                    onDragStart={e => handleDragStart(e, i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={e => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={[
                      'flex items-center gap-2 px-3 py-2 bg-neopop-white select-none',
                      dragIndex === i ? 'opacity-40' : '',
                      dragOverIndex === i && dragIndex !== i ? 'border-t-2 !border-t-neopop-red' : '',
                    ].join(' ')}
                  >
                    {/* Drag handle — desktop only hint */}
                    <span
                      className="text-ws-black/50 cursor-grab text-[18px] leading-none shrink-0 hidden sm:block"
                      title="Drag to reorder"
                    >⠿</span>

                    {/* Hostname */}
                    <span className="text-[14px] text-ws-black font-medium truncate flex-1 min-w-0">
                      {urlHostname(url)}
                    </span>

                    {/* Full URL — truncated, desktop only */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-ws-black/70 underline hover:no-underline hidden md:block truncate max-w-[160px]"
                      title={url}
                    >
                      {url}
                    </a>

                    {/* Up/down arrows — visible on mobile and desktop */}
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveUrl(i, -1)}
                        disabled={disabled || i === 0}
                        className="text-ws-black/50 hover:text-ws-black disabled:opacity-20 px-1 text-[14px] leading-none"
                        title="Move up"
                        aria-label="Move up"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveUrl(i, 1)}
                        disabled={disabled || i === urls.length - 1}
                        className="text-ws-black/50 hover:text-ws-black disabled:opacity-20 px-1 text-[14px] leading-none"
                        title="Move down"
                        aria-label="Move down"
                      >↓</button>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
                      disabled={disabled}
                      className="text-ws-black/70 hover:text-red-700 disabled:opacity-40 ml-1 text-[15px] leading-none shrink-0"
                      title={`Remove ${url}`}
                      aria-label={`Remove ${urlHostname(url)}`}
                    >✕</button>
                  </div>
                ))}
              </div>

              {/* Add more */}
              {!showAddMore ? (
                <button
                  type="button"
                  onClick={() => setShowAddMore(true)}
                  disabled={disabled}
                  className="text-[14px] text-ws-accent underline hover:no-underline self-start disabled:opacity-50"
                >
                  + Add another URL
                </button>
              ) : (
                <div className="flex flex-col gap-1">
                  <textarea
                    rows={2}
                    value={addText}
                    onChange={e => setAddText(e.target.value)}
                    onPaste={e => applySmartPaste(e, addText, setAddText)}
                    placeholder="Paste URL(s) to add…"
                    disabled={disabled}
                    autoFocus
                    className="border-2 border-neopop-black px-3 py-2 text-[15px] font-mono resize-none w-full focus-visible:outline-none focus-visible:border-neopop-red"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddMoreSubmit}
                      disabled={!addText.trim()}
                      className="text-[13px] font-bold bg-neopop-red text-white px-3 py-1 hover:bg-neopop-red-dark disabled:opacity-50"
                    >Add</button>
                    <button
                      type="button"
                      onClick={() => { setShowAddMore(false); setAddText('') }}
                      className="text-[13px] text-ws-black/70 underline hover:no-underline"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <textarea
                rows={4}
                value={value}
                onChange={e => onChange(e.target.value)}
                onPaste={e => applySmartPaste(e, value, onChange)}
                disabled={disabled}
                placeholder={placeholder ?? 'Paste one URL per line — or paste any text and URLs are extracted automatically'}
                className="border-2 border-neopop-black px-3 py-2 text-[17px] text-ws-black font-mono resize-y w-full focus-visible:outline-none focus-visible:ring-0 focus-visible:border-neopop-red disabled:bg-neopop-cream disabled:cursor-not-allowed"
              />
              <p className="text-[12px] text-ws-black/70">
                One URL per line. Supports articles and PDFs. Paste any text and URLs are extracted automatically.
              </p>
            </>
          )}
      </div>
    </div>
  )
}

// ─── QuickAdd ─────────────────────────────────────────────────────────────────────

function QuickAdd({
  password,
  onAdd,
  disabled,
}: {
  password: string
  onAdd: (url: string, section: SectionKey) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{ section: SectionKey; title: string | null } | null>(null)
  const [overrideSection, setOverrideSection] = useState<SectionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  const activeSection: SectionKey = overrideSection ?? suggestion?.section ?? 'top'

  async function handleSuggest() {
    if (!url.startsWith('http')) return
    setLoading(true)
    setError(null)
    setSuggestion(null)
    setOverrideSection(null)
    setAdded(false)
    try {
      const res = await fetch('/api/suggest-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, url }),
      })
      const data = await res.json() as { section?: SectionKey; title?: string | null; error?: string }
      if (data.error) { setError(data.error); return }
      setSuggestion({ section: data.section ?? 'top', title: data.title ?? null })
    } catch {
      setError('Could not reach the server. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleAdd() {
    onAdd(url, activeSection)
    setAdded(true)
    setUrl('')
    setSuggestion(null)
    setOverrideSection(null)
    setError(null)
    setTimeout(() => setAdded(false), 2000)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border-[3px] border-neopop-black bg-neopop-yellow text-ws-black font-black uppercase tracking-wide text-[14px] px-4 py-2 self-start shadow-[4px_4px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-neopop-black)]"
      >
        ✦ Quick Add a URL
      </button>
    )
  }

  return (
    <div className="border-[3px] border-neopop-black bg-neopop-yellow p-5 flex flex-col gap-3 shadow-[6px_6px_0_0_var(--color-neopop-black)]">
      <div className="flex items-center justify-between">
        <p className="font-black uppercase tracking-wide text-[14px]">Quick Add — paste a URL</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setSuggestion(null); setError(null) }}
          className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline"
        >
          Hide
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setSuggestion(null); setError(null); setAdded(false) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSuggest() } }}
          placeholder="https://…"
          disabled={disabled || loading}
          className="flex-1 border-[3px] border-neopop-black px-3 py-2 text-[15px] font-mono bg-neopop-white focus-visible:outline-none focus-visible:border-neopop-red disabled:opacity-70 min-w-0"
        />
        <button
          type="button"
          onClick={handleSuggest}
          disabled={disabled || loading || !url.startsWith('http')}
          className="border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[14px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? '↻ Thinking…' : 'Suggest section'}
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent" role="alert">{error}</p>}

      {added && (
        <p className="text-[14px] font-black uppercase tracking-wide">✓ Added to {SECTION_LABELS[activeSection]}</p>
      )}

      {suggestion && !added && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[13px] font-bold uppercase tracking-wide">Section:</span>
          <select
            value={activeSection}
            onChange={e => setOverrideSection(e.target.value as SectionKey)}
            className="border-[3px] border-neopop-black px-3 py-2 text-[14px] font-bold bg-neopop-white focus-visible:outline-none focus-visible:border-neopop-red"
          >
            {SECTION_KEYS.map(k => (
              <option key={k} value={k}>{SECTION_LABELS[k]}</option>
            ))}
          </select>
          {suggestion.title && (
            <span className="text-[13px] text-ws-black/70 truncate max-w-xs">— {suggestion.title}</span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="border-[3px] border-neopop-black bg-neopop-black text-neopop-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-neopop-red)] hover:bg-neopop-red shrink-0"
          >
            ✓ Add to {SECTION_LABELS[activeSection]}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SummaryPreview ──────────────────────────────────────────────────────────────

function SummaryPreview({
  label, summaries, onEdit, onRegenerate, regeneratingUrl,
}: {
  label: string
  summaries: SectionSummary[]
  onEdit: (url: string, text: string) => void
  onRegenerate: (url: string) => void
  regeneratingUrl: string | null
}) {
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  if (summaries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-bold text-[16px] text-ws-black border-b border-neopop-black/30 pb-1">{label}</h3>
      {summaries.map(({ url, title, publishedDate, imageUrl, summary }) => {
        const isEditing = editingUrl === url
        const isRegenerating = regeneratingUrl === url
        return (
          <div key={url} className="border-l-4 border-neopop-black/30 pl-3 flex flex-col gap-1.5">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={title ?? ''} className="w-full max-h-40 object-cover rounded mb-1" />
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-[15px] text-ws-black underline hover:no-underline">
              {title ?? url}
            </a>
            {publishedDate && <p className="text-[13px] text-ws-black/70">Published: {publishedDate}</p>}

            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={4}
                  autoFocus
                  className="border-2 border-neopop-red px-3 py-2 text-[15px] text-ws-black resize-y w-full focus-visible:outline-none"
                />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[12px] text-ws-black/70">{editText.length} chars</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { onEdit(url, editText); setEditingUrl(null) }}
                      className="text-[13px] font-bold bg-neopop-red text-white px-3 py-1 hover:bg-neopop-red-dark">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingUrl(null)}
                      className="text-[13px] text-ws-black/70 underline hover:no-underline">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-[15px] text-ws-black">{summary}</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[12px] text-ws-black/70">{summary.length} chars</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setEditingUrl(url); setEditText(summary) }}
                      className="text-[13px] text-ws-accent underline hover:no-underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => onRegenerate(url)}
                      disabled={isRegenerating || regeneratingUrl !== null}
                      className="text-[13px] text-ws-accent underline hover:no-underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">
                      {isRegenerating ? '↻ Regenerating…' : '↻ Regenerate'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-ws-black/70 underline hover:no-underline break-all">
              {url}
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ─── SiteStats ───────────────────────────────────────────────────────────────────

interface StatsData {
  totalPublished: number
  draftsCount: number
  recentPublished: number
  latestIssue: { issueNumber: number; issueDate: string; title: string } | null
}

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
    <div className="border-[3px] border-neopop-black bg-neopop-white p-5 shadow-[4px_4px_0_0_var(--color-neopop-black)]">
      <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70 mb-4">Site stats</p>

      {loading && <p className="text-[14px] text-ws-black/70">Loading…</p>}
      {error && <p className="text-[14px] text-ws-accent font-bold">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border-[2px] border-neopop-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.totalPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Published issues</p>
          </div>
          <div className="border-[2px] border-neopop-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.recentPublished}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Issues last 30 days</p>
          </div>
          <div className="border-[2px] border-neopop-black px-4 py-3 flex flex-col gap-1">
            <p className="text-[32px] font-black leading-none">{stats.draftsCount}</p>
            <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/70">Drafts in queue</p>
          </div>
          <div className="border-[2px] border-neopop-black px-4 py-3 flex flex-col gap-1">
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

// ─── GenerateEmailFromPublished ──────────────────────────────────────────────────

interface PublishedIssue {
  id: string
  issueNumber: number
  issueDate: string
  title: string
}

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
      <div className="border-[3px] border-neopop-black bg-neopop-white p-5 shadow-[4px_4px_0_0_var(--color-neopop-black)]">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Generate email from published issue</p>
          <button
            type="button"
            onClick={handleOpen}
            className="border-[3px] border-neopop-black bg-neopop-black text-neopop-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-neopop-red)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-neopop-red)] hover:bg-neopop-red"
          >
            ✉️ Generate email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-[3px] border-neopop-black bg-neopop-white p-5 shadow-[4px_4px_0_0_var(--color-neopop-black)] flex flex-col gap-4">
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
            className="flex-1 border-[3px] border-neopop-black px-3 py-2 text-[14px] font-bold bg-neopop-white focus-visible:outline-none focus-visible:border-neopop-red"
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
            className="border-[3px] border-neopop-black bg-neopop-black text-neopop-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-neopop-red)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-neopop-red)] hover:bg-neopop-red disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {emailLoading ? '…Generating' : '✉️ Generate'}
          </button>
        </div>
      )}

      {emailError && <p className="text-[13px] font-bold text-ws-accent">{emailError}</p>}

      {emailDraft && (
        <div className="border-[2px] border-neopop-black bg-neopop-white flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b-[2px] border-neopop-black px-4 py-2">
            <p className="text-[12px] font-black uppercase tracking-[0.15em]">Generated email</p>
            <button type="button" onClick={handleCopy}
              className="text-[12px] font-black uppercase tracking-wide border-[2px] border-neopop-black px-3 py-1 hover:bg-neopop-cream">
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

// Lists every unpublished draft in Notion with a one-click publish button.
// Publishing sets Published=true on the Notion page AND calls revalidate
// so the issue appears on the public site immediately.
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
    // Two-step confirm — deletion is irreversible from the admin UI.
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
    <div className="border-[3px] border-neopop-black bg-neopop-white p-5 shadow-[4px_4px_0_0_var(--color-neopop-black)]">
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

      {message && (
        <p className="text-[14px] font-bold text-ws-black mb-3">{message}</p>
      )}
      {error && (
        <p className="text-[14px] font-bold text-ws-accent mb-3">{error}</p>
      )}

      {loading && !drafts ? (
        <p className="text-[14px] text-ws-black/70">Loading drafts…</p>
      ) : drafts && drafts.length === 0 ? (
        <p className="text-[14px] text-ws-black/70">
          No unpublished drafts. Generate one below to start a new issue.
        </p>
      ) : drafts && drafts.length > 0 ? (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {drafts.map(draft => {
            // Notion accepts the page ID without dashes as a valid URL
            const notionUrl = `https://notion.so/${draft.id.replace(/-/g, '')}`
            return (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 flex-wrap border-[2px] border-neopop-black/30 px-3 py-2 hover:bg-neopop-cream"
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
                    className="border-[2px] border-neopop-black bg-neopop-white text-ws-black font-bold uppercase tracking-wide text-[12px] px-2 py-1.5 hover:bg-neopop-cream disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move to Notion trash"
                  >
                    {archiving === draft.id ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePublish(draft)}
                    disabled={publishing !== null || archiving !== null}
                    className="border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[13px] px-3 py-1.5 shadow-[3px_3px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="mt-4 border-[3px] border-neopop-black bg-neopop-cream p-4 shadow-[4px_4px_0_0_var(--color-neopop-black)] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[13px] font-black uppercase tracking-[0.12em]">
              Issue #{justPublished.issueNumber} published — generate highlights email?
            </p>
            <button
              type="button"
              onClick={handleGenerateEmail}
              disabled={emailLoading}
              className="border-[3px] border-neopop-black bg-neopop-black text-neopop-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-neopop-red)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-neopop-red)] hover:bg-neopop-red disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailLoading ? '…Generating' : '✉️ Generate email'}
            </button>
          </div>

          {emailError && (
            <p className="text-[13px] font-bold text-ws-accent">{emailError}</p>
          )}

          {emailDraft && (
            <div className="border-[2px] border-neopop-black bg-neopop-white flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b-[2px] border-neopop-black px-4 py-2">
                <p className="text-[12px] font-black uppercase tracking-[0.15em]">Generated email</p>
                <button type="button" onClick={handleCopyEmail}
                  className="text-[12px] font-black uppercase tracking-wide border-[2px] border-neopop-black px-3 py-1 hover:bg-neopop-cream">
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

      <div className="mt-4 pt-3 border-t-[2px] border-neopop-black/20 flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] text-ws-black/70">
          Edited a typo on an already-published issue?
        </p>
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

// ─── StatusLog ───────────────────────────────────────────────────────────────────

function StatusLog({ items }: { items: string[] }) {
  const logRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [items])
  if (items.length === 0) return null
  return (
    <ul ref={logRef}
      className="border border-neopop-black/30 bg-neopop-cream max-h-48 overflow-y-auto font-mono text-[13px] text-ws-black p-2 flex flex-col gap-0.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

// ─── SummaryLengthPicker ─────────────────────────────────────────────────────────

function SummaryLengthPicker({ value, onChange, disabled }: {
  value: SummaryLength; onChange: (v: SummaryLength) => void; disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-black uppercase tracking-wide text-ws-black/70">Summary length</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {(['brief', 'standard', 'detailed'] as const).map(l => (
          <label key={l} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="summaryLength" value={l} checked={value === l}
              onChange={() => onChange(l)} disabled={disabled}
              className="accent-neopop-black cursor-pointer" />
            <span className="text-[14px]">{SUMMARY_LENGTH_LABELS[l]}</span>
          </label>
        ))}
      </div>
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

  // ── Global settings
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('standard')

  // ── Form state
  const [sections, setSections] = useState({ ...EMPTY_SECTIONS })
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({ ...ALL_COLLAPSED })
  const [includeImages, setIncludeImages] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createLog, setCreateLog] = useState<string[]>([])
  const [result, setResult] = useState<CompletedCreate | null>(null)
  const [wasUpdate, setWasUpdate] = useState(false)
  // Pre-check: is there already a draft for this week's target Monday?
  // If yes, Generate will append to it instead of creating a new page.
  const [currentWeekDraft, setCurrentWeekDraft] = useState<DraftIssue | null>(null)
  const [resultSummaries, setResultSummaries] = useState<Record<SectionKey, SectionSummary[]>>({ ...EMPTY_SUMMARIES })
  const [apiError, setApiError] = useState<string | null>(null)
  const [createValidationError, setCreateValidationError] = useState<string | null>(null)

  // ── Regenerate
  const [regeneratingUrl, setRegeneratingUrl] = useState<string | null>(null)

  // ── Session restore
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null)

  // ── Copy as email
  const [copiedEmail, setCopiedEmail] = useState(false)

  // ── Generate email highlights
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [copiedEmailDraft, setCopiedEmailDraft] = useState(false)

  // ── Duplicate check
  const [duplicates, setDuplicates] = useState<{ url: string; issueNumber: number; issueDate: string; issueTitle: string }[]>([])
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [duplicateChecked, setDuplicateChecked] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  // ── Document title
  useEffect(() => {
    if (!authed) document.title = 'Admin sign in — AI This Week'
    else if (result) document.title = 'Issue created — Admin — AI This Week'
    else document.title = 'Admin — AI This Week'
  }, [authed, result])

  // ── Restore auth from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (stored) { setPassword(stored); setAuthed(true) }
    else passwordRef.current?.focus()
  }, [])

// ── Load saved session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('adminLastSession')
      if (stored) {
        const parsed = JSON.parse(stored) as SavedSession
        if (parsed.sections && parsed.savedAt) setSavedSession(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // ── On auth (and after each Generate), look up whether any unpublished
  // draft exists in Notion. Drives the "Appending to Issue #N" banner
  // and the button label. Takes the most recent draft if there are several.
  useEffect(() => {
    if (!authed || !password) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/draft-issues?password=${encodeURIComponent(password)}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        const drafts = (data.issues ?? []) as DraftIssue[]
        if (!cancelled) setCurrentWeekDraft(drafts[0] ?? null)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
    // Re-run after a successful generate so the banner flips from "Will
    // create" to "Appending to Issue #N" without requiring a page reload.
  }, [authed, password, result])

  // ── Auto-save URLs to localStorage (debounced 1s) — keeps your in-progress issue across sessions
  useEffect(() => {
    if (!authed) return
    const hasContent = SECTION_KEYS.some(k => sections[k].trim().length > 0)
    if (!hasContent) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('adminLastSession', JSON.stringify({
          savedAt: new Date().toISOString(), sections,
        } satisfies SavedSession))
      } catch { /* ignore */ }
    }, 1000)
    return () => clearTimeout(timer)
  }, [authed, sections])

  // ── Auth handlers
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    try {
      const res = await fetch('/api/new-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, sections: { ...EMPTY_SECTIONS } }),
      })
      if (res.status === 401) { setAuthError('Incorrect password.'); setAuthLoading(false); return }
      try { await res.body?.cancel() } catch { /* ignore */ }
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

  // ── Stream reader
  async function readStream(res: Response, onEvent: (event: ProgressEvent) => void): Promise<void> {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try { onEvent(JSON.parse(line.slice(6)) as ProgressEvent) } catch { /* skip */ }
      }
    }
  }

  // ── Find the draft to append to — the most recent unpublished draft in
  // Notion, if any. We don't match by date anymore because client (local tz)
  // and server (UTC) can disagree on what "next Monday" is, which produced
  // duplicate drafts. Simpler model: one unpublished draft at a time, and
  // Generate always appends to it until it's published.
  async function findExistingDraft(): Promise<DraftIssue | null> {
    try {
      const res = await fetch(`/api/draft-issues?password=${encodeURIComponent(password)}`)
      if (!res.ok) return null
      const data = await res.json()
      const drafts = (data.issues ?? []) as DraftIssue[]
      // /api/draft-issues returns drafts sorted by Issue Date descending,
      // so drafts[0] is the most recent unpublished one.
      return drafts[0] ?? null
    } catch {
      return null
    }
  }

  // ── Generate handler — creates a new draft OR appends to the current
  // week's existing unpublished draft. Decides by querying Notion for a
  // draft matching nextMonday() right before it fires.
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setCreateValidationError(null)
    const hasUrls = SECTION_KEYS.some(k => sections[k].trim().length > 0)
    if (!hasUrls) { setCreateValidationError('Please paste at least one URL before generating.'); return }
    setLoading(true)
    setApiError(null)
    setResult(null)
    setResultSummaries({ ...EMPTY_SUMMARIES })
    setCreateLog([])

    // Check for an existing draft for this week's Monday — if there is one,
    // we append to it instead of creating a second Notion page.
    const existingDraft = await findExistingDraft()
    const isUpdate = existingDraft !== null
    const endpoint = isUpdate ? '/api/update-issue' : '/api/new-issue'
    const body = isUpdate
      ? { password, pageId: existingDraft!.id, sections, includeImages, summaryLength }
      : { password, sections, includeImages, summaryLength }

    if (isUpdate) {
      setCreateLog([`→ Adding to existing draft (Issue #${existingDraft!.issueNumber})`])
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        sessionStorage.removeItem('adminAuth'); setAuthed(false); setPassword('')
        setAuthError('Session expired. Please sign in again.'); return
      }
      await readStream(res, (event) => {
        switch (event.type) {
          case 'fetch':    setCreateLog(p => [...p, `⏳ Fetching ${urlHostname(event.url)}…`]); break
          case 'pdf':      setCreateLog(p => [...p, `📄 Extracting PDF text…`]); break
          case 'summarise':setCreateLog(p => [...p, `🤖 Summarising…`]); break
          case 'done_url': setCreateLog(p => [...p, `✓ Done — ${event.summary.slice(0, 80)}…`]); break
          case 'notion':   setCreateLog(p => [...p, isUpdate ? `✍️ Appending to Notion page…` : `✍️ Creating Notion page…`]); break
          case 'complete':
            setResult({
              notionUrl: event.notionUrl,
              // update-issue doesn't emit issueNumber, fall back to the one
              // we picked up when we looked the draft up
              issueNumber: event.issueNumber ?? existingDraft?.issueNumber ?? 0,
            })
            setWasUpdate(isUpdate)
            setResultSummaries(event.summaries as Record<SectionKey, SectionSummary[]>)
            try { localStorage.removeItem('adminLastSession') } catch { /* ignore */ }
            break
          case 'error': setApiError(event.message); break
        }
      })
    } catch { setApiError('Network error. Check your connection and try again.') }
    finally { setLoading(false) }
  }

  // ── Regenerate single summary
  async function handleRegenerate(url: string) {
    setRegeneratingUrl(url)
    try {
      const res = await fetch('/api/summarise-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, url, summaryLength }),
      })
      if (!res.ok) return
      const data = await res.json() as { summary: string; title: string | null; publishedDate: string | null; imageUrl: string | null }
      if (!data.summary) return
      setResultSummaries(prev => {
        const next = { ...prev }
        for (const key of SECTION_KEYS) {
          next[key] = (next[key] ?? []).map(s =>
            s.url === url ? { ...s, summary: data.summary, title: data.title ?? s.title, publishedDate: data.publishedDate ?? s.publishedDate, imageUrl: data.imageUrl ?? s.imageUrl } : s
          )
        }
        return next
      })
    } catch { /* silent */ }
    finally { setRegeneratingUrl(null) }
  }

  // ── Edit summary inline
  function handleEditSummary(url: string, text: string) {
    setResultSummaries(prev => {
      const next = { ...prev }
      for (const key of SECTION_KEYS) {
        next[key] = (next[key] ?? []).map(s => s.url === url ? { ...s, summary: text } : s)
      }
      return next
    })
  }

  // ── Copy as email
  async function handleCopyEmail(summaries: Record<SectionKey, SectionSummary[]>) {
    try {
      await navigator.clipboard.writeText(formatSummariesAsEmail(summaries))
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  // ── Generate email highlights
  async function handleGenerateEmail() {
    if (!result || !hasSummaryContent(resultSummaries)) return
    setEmailLoading(true)
    setEmailDraft(null)
    try {
      const issueUrl = currentWeekDraft?.issueDate
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/issues/${currentWeekDraft.issueDate}`
        : undefined
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, summaries: resultSummaries, issueNumber: result.issueNumber, issueUrl }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEmailDraft(data)
    } catch { /* silent */ }
    finally { setEmailLoading(false) }
  }

  async function handleCopyEmailDraft() {
    if (!emailDraft) return
    try {
      await navigator.clipboard.writeText(`Subject: ${emailDraft.subject}\n\n${emailDraft.body}`)
      setCopiedEmailDraft(true)
      setTimeout(() => setCopiedEmailDraft(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  // ── Check for duplicate URLs across past issues
  async function handleCheckDuplicates() {
    const allUrls = SECTION_KEYS.flatMap(k => parseUrlLines(sections[k]))
    if (allUrls.length === 0) return
    setDuplicateLoading(true)
    setDuplicates([])
    setDuplicateChecked(false)
    try {
      const res = await fetch('/api/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, urls: allUrls }),
      })
      const data = await res.json()
      setDuplicates(data.duplicates ?? [])
      setDuplicateChecked(true)
    } catch { /* silent */ }
    finally { setDuplicateLoading(false) }
  }

  // ── Session restore
  function handleRestoreSession() {
    if (!savedSession) return
    setSections(savedSession.sections)
    const expanded: Record<SectionKey, boolean> = { ...ALL_COLLAPSED }
    for (const key of SECTION_KEYS) {
      if (savedSession.sections[key]?.trim()) expanded[key] = true
    }
    setExpandedSections(expanded)
    setSavedSession(null)
    try { localStorage.removeItem('adminLastSession') } catch { /* ignore */ }
  }

  function handleDismissSession() {
    setSavedSession(null)
    try { localStorage.removeItem('adminLastSession') } catch { /* ignore */ }
  }

  // ── Quick Add: adds a URL to a section and expands it
  function handleQuickAdd(url: string, section: SectionKey) {
    setSections(prev => {
      const existing = prev[section].trim()
      return { ...prev, [section]: existing ? `${existing}\n${url}` : url }
    })
    setExpandedSections(prev => ({ ...prev, [section]: true }))
    setCreateValidationError(null)
  }

// ── Reset
  function handleReset() {
    setSections({ ...EMPTY_SECTIONS })
    setExpandedSections({ ...ALL_COLLAPSED })
    setResult(null); setResultSummaries({ ...EMPTY_SUMMARIES })
    setApiError(null); setCreateLog([]); setCreateValidationError(null); setCopiedEmail(false)
    setEmailDraft(null); setEmailLoading(false); setCopiedEmailDraft(false)
    setDuplicates([]); setDuplicateLoading(false); setDuplicateChecked(false)
    setWasUpdate(false)
  }

  function toggleSection(key: SectionKey) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Render helpers
  function renderSuccessActions(notionUrl: string, summaries: Record<SectionKey, SectionSummary[]>) {
    return (
      <div className="flex flex-wrap gap-3">
        <a href={notionUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-neopop-red text-white font-bold text-[17px] px-5 py-3 hover:bg-neopop-red-dark no-underline">
          Open in Notion &rarr;
        </a>
        {hasSummaryContent(summaries) && (
          <>
            <button type="button" onClick={() => handleCopyEmail(summaries)}
              className="inline-flex items-center gap-2 border-2 border-neopop-black text-ws-black font-bold text-[17px] px-5 py-3 hover:bg-neopop-cream">
              {copiedEmail ? '✓ Copied!' : '📋 Copy as plain text'}
            </button>
            <button type="button" onClick={handleGenerateEmail} disabled={emailLoading}
              className="inline-flex items-center gap-2 border-2 border-neopop-black text-ws-black font-bold text-[17px] px-5 py-3 hover:bg-neopop-cream disabled:opacity-50 disabled:cursor-not-allowed">
              {emailLoading ? '…Generating' : '✉️ Generate email'}
            </button>
          </>
        )}
      </div>
    )
  }

  function renderEmailDraft() {
    if (!emailDraft) return null
    return (
      <div className="border-[3px] border-neopop-black bg-neopop-white shadow-[6px_6px_0_0_var(--color-neopop-black)]">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-neopop-black px-5 py-3">
          <p className="text-[13px] font-black uppercase tracking-[0.15em]">Generated email</p>
          <button type="button" onClick={handleCopyEmailDraft}
            className="text-[13px] font-black uppercase tracking-wide border-2 border-neopop-black px-3 py-1 hover:bg-neopop-cream">
            {copiedEmailDraft ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Subject</p>
            <p className="text-[15px] font-bold">{emailDraft.subject}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-ws-black/50 mb-1">Body</p>
            <pre className="text-[14px] font-sans whitespace-pre-wrap leading-relaxed">{emailDraft.body}</pre>
          </div>
        </div>
      </div>
    )
  }

  function renderSummaryPreviews(summaries: Record<SectionKey, SectionSummary[]>) {
    if (!hasSummaryContent(summaries)) return null
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-[22px] font-bold text-ws-black">Generated summaries</h2>
          <p className="text-[13px] text-ws-black/70">Click Edit or ↻ Regenerate on any summary to modify it.</p>
        </div>
        {SECTION_KEYS.map(key => (
          <SummaryPreview
            key={key}
            label={SECTION_LABELS[key]}
            summaries={summaries[key] ?? []}
            onEdit={handleEditSummary}
            onRegenerate={handleRegenerate}
            regeneratingUrl={regeneratingUrl}
          />
        ))}
      </div>
    )
  }

  // ── Render: sign-in ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="max-w-md">
        <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-3">
          Admin sign in
        </h1>
        <div className="w-16 h-[3px] bg-ws-accent mb-8" aria-hidden="true" />
        <div className="border-[3px] border-neopop-black bg-neopop-white p-6 shadow-[8px_8px_0_0_var(--color-neopop-black)]">
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
                className="border-[3px] border-neopop-black px-3 py-3 text-[17px] font-mono w-full focus-visible:outline-none focus-visible:border-neopop-red disabled:bg-neopop-cream"
              />
              {authError && (
                <p className="text-[14px] font-bold text-ws-accent" role="alert">{authError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={authLoading || !password}
              className="border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[15px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Render: create success ────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="max-w-3xl flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={handleReset}
            className="text-[13px] font-black uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
          >
            ← Back to admin
          </button>
          <button onClick={handleSignOut} className="text-[13px] font-black uppercase tracking-wide underline hover:no-underline hover:text-ws-accent">
            Sign out
          </button>
        </div>
        <div className="border-[3px] border-neopop-black bg-neopop-yellow p-5 shadow-[6px_6px_0_0_var(--color-neopop-black)]">
          <p className="text-[13px] font-black uppercase tracking-[0.15em] mb-2">
            {wasUpdate ? '✓ URLs added' : '✓ Draft created'}
          </p>
          <p className="text-[28px] font-black uppercase tracking-tight leading-tight">
            Issue #{result.issueNumber} {wasUpdate ? 'updated' : 'ready to review'}
          </p>
        </div>

        {/* Primary next action — add more URLs to this same issue */}
        <button
          type="button"
          onClick={handleReset}
          className="inline-block border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[17px] px-6 py-3 self-start shadow-[6px_6px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-neopop-black)]"
        >
          + Add more URLs to this issue
        </button>

        {renderSuccessActions(result.notionUrl, resultSummaries)}
        {renderEmailDraft()}
        {renderSummaryPreviews(resultSummaries)}
      </div>
    )
  }

  // ── Render: main form ─────────────────────────────────────────────────────────

  const isFormBusy = loading

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

      {/* Session restore banner */}
      {savedSession && (
        <div className="border-[3px] border-neopop-black bg-neopop-yellow px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-black)] flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <p className="text-[15px]">
            <strong className="uppercase tracking-wide">In-progress issue</strong> from {formatSavedAt(savedSession.savedAt)} — restore your URLs?
          </p>
          <div className="flex gap-4 shrink-0">
            <button onClick={handleRestoreSession} className="text-[14px] font-black uppercase tracking-wide underline hover:no-underline">Restore</button>
            <button onClick={handleDismissSession} className="text-[14px] text-ws-black/70 underline hover:no-underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* AI notice */}
      <div className="border-[3px] border-neopop-black bg-neopop-cream px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-black)]">
        <p className="text-[14px] font-bold">
          <span className="uppercase tracking-wide">Heads up —</span> All summaries are AI-generated. Review official sources. Minor editing happens prior to publishing.
        </p>
      </div>

      {/* Site stats */}
      <SiteStats password={password} />

      {/* Publish drafts */}
      <PublishDrafts password={password} />

      {/* Generate email from any previously published issue */}
      <GenerateEmailFromPublished password={password} />

      {/* Issue metadata */}
      <div className="border-[3px] border-neopop-black bg-neopop-white p-5 shadow-[4px_4px_0_0_var(--color-neopop-black)] flex flex-col gap-4">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Issue details</p>
        <p className="text-[17px]">
          <span className="font-bold">Date:</span> {nextFriday()}
          <span className="mx-3 text-ws-black/40">·</span>
          <span className="font-bold">Number:</span> auto
        </p>
        <label className="flex items-center gap-3 cursor-pointer self-start">
          <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)}
            className="w-5 h-5 border-2 border-neopop-black accent-neopop-black cursor-pointer" />
          <span className="text-[15px] font-bold">Include images</span>
          <span className="text-[13px] text-ws-black/70">(og:image from each article)</span>
        </label>
        <SummaryLengthPicker value={summaryLength} onChange={setSummaryLength} disabled={isFormBusy} />
      </div>

      {/* Quick Add — adds URLs to the right section textarea below */}
      <QuickAdd
        password={password}
        onAdd={handleQuickAdd}
        disabled={isFormBusy}
      />

      <form onSubmit={handleGenerate} noValidate className="flex flex-col gap-6">
        {SECTION_KEYS.map(key => (
          <SectionTextarea
            key={key}
            label={SECTION_LABELS[key]}
            value={sections[key]}
            onChange={v => { setSections(s => ({ ...s, [key]: v })); setCreateValidationError(null) }}
            disabled={isFormBusy}
            expanded={expandedSections[key]}
            onToggle={() => toggleSection(key)}
          />
        ))}

        {createValidationError && (
          <div className="border-[3px] border-neopop-red bg-neopop-white px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-red)]" role="alert">
            <p className="text-[15px] font-bold text-ws-accent">{createValidationError}</p>
          </div>
        )}
        {apiError && (
          <div className="border-[3px] border-neopop-red bg-neopop-white px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-red)]" role="alert">
            <p className="text-[14px] font-black uppercase tracking-wide text-ws-accent">Error</p>
            <p className="text-[15px] text-ws-black">{apiError}</p>
          </div>
        )}

        <StatusLog items={createLog} />

        {/* Smart Generate button — tells you whether it'll create or append
            so you know before clicking */}
        {currentWeekDraft && !loading && (
          <p className="text-[13px] font-bold text-ws-black">
            <span className="uppercase tracking-wide">↪ Will append to</span>{' '}
            <a
              href={`https://notion.so/${currentWeekDraft.id.replace(/-/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline hover:text-ws-accent"
            >
              Issue #{currentWeekDraft.issueNumber}
            </a>{' '}
            ({currentWeekDraft.issueDate}). Publish it from the list above if you want to start a fresh one.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCheckDuplicates}
            disabled={isFormBusy || duplicateLoading}
            className="inline-block border-2 border-neopop-black text-ws-black font-bold text-[15px] px-5 py-2 self-start hover:bg-neopop-cream disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {duplicateLoading ? '…Checking' : '🔍 Check for duplicates'}
          </button>

          {duplicateChecked && duplicates.length === 0 && (
            <div className="border-2 border-neopop-black bg-neopop-white px-4 py-3">
              <p className="text-[14px] font-bold">✓ No duplicates found in the last {12} issues.</p>
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="border-[3px] border-neopop-yellow bg-neopop-yellow px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-black)] flex flex-col gap-2">
              <p className="text-[13px] font-black uppercase tracking-[0.15em]">
                {duplicates.length} duplicate{duplicates.length > 1 ? 's' : ''} found
              </p>
              {duplicates.map(d => (
                <div key={d.url} className="text-[14px]">
                  <span className="font-bold">{new URL(d.url).hostname}</span>
                  {' — appeared in '}
                  <span className="font-bold">Issue #{d.issueNumber}</span>
                  {' ('}
                  <a
                    href={`${process.env.NEXT_PUBLIC_BASE_URL}/issues/${d.issueDate}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    {d.issueDate}
                  </a>
                  {')'}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isFormBusy}
          className="inline-block border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[17px] px-6 py-3 self-start shadow-[6px_6px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-neopop-black)] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {loading
            ? (currentWeekDraft ? 'Appending…' : 'Generating draft…')
            : (currentWeekDraft ? `✦ Add to Issue #${currentWeekDraft.issueNumber}` : '✦ Generate Draft')}
        </button>
      </form>
    </div>
  )
}
