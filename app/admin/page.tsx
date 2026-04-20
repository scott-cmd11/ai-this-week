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

type SectionKey = 'top' | 'bright' | 'tool' | 'learning' | 'deep'

interface CompletedCreate { notionUrl: string; issueNumber: number }

// ─── Constants ──────────────────────────────────────────────────────────────────

const SECTION_KEYS: SectionKey[] = ['top', 'bright', 'tool', 'learning', 'deep']

const SECTION_LABELS: Record<SectionKey, string> = {
  top: 'Top Stories',
  bright: 'Bright Spot',
  tool: 'Tool of the Week',
  learning: 'Learning',
  deep: 'Deep Dive',
}

const SECTION_EMAIL_HEADINGS: Record<SectionKey, string> = {
  top: 'TOP STORIES',
  bright: 'BRIGHT SPOT OF THE WEEK',
  tool: 'TOOL OF THE WEEK',
  learning: 'LEARNING',
  deep: 'DEEP DIVE',
}

const EMPTY_SECTIONS: Record<SectionKey, string> = { top: '', bright: '', tool: '', learning: '', deep: '' }
const ALL_COLLAPSED: Record<SectionKey, boolean> = { top: false, bright: false, tool: false, learning: false, deep: false }
const EMPTY_SUMMARIES: Record<SectionKey, SectionSummary[]> = { top: [], bright: [], tool: [], learning: [], deep: [] }

const SUMMARY_LENGTH_LABELS: Record<SummaryLength, string> = {
  brief: 'Brief (1–2 sentences)',
  standard: 'Standard (2–3 sentences)',
  detailed: 'Detailed (3–4 sentences)',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function nextMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntil)
  return monday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[17px] text-govuk-black">{label}</span>
          {urls.length > 0 && (
            <span className="text-[12px] font-bold text-white bg-govuk-blue px-1.5 py-0.5 rounded-sm">
              {urls.length} URL{urls.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="text-[14px] text-govuk-blue hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {expanded ? '− Collapse' : '＋ Add URL'}
        </button>
      </div>

      {expanded && (
        <>
          {hasUrls ? (
            <div className="flex flex-col gap-1.5">
              {/* Drag-to-reorder list */}
              <div className="border-2 border-govuk-black divide-y divide-govuk-light-grey">
                {urls.map((url, i) => (
                  <div
                    key={`${i}:${url}`}
                    draggable={!disabled}
                    onDragStart={e => handleDragStart(e, i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={e => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                    className={[
                      'flex items-center gap-2 px-3 py-2 bg-white select-none',
                      dragIndex === i ? 'opacity-40' : '',
                      dragOverIndex === i && dragIndex !== i ? 'border-t-2 !border-t-govuk-blue' : '',
                    ].join(' ')}
                  >
                    {/* Drag handle — desktop only hint */}
                    <span
                      className="text-govuk-mid-grey cursor-grab text-[18px] leading-none shrink-0 hidden sm:block"
                      title="Drag to reorder"
                    >⠿</span>

                    {/* Hostname */}
                    <span className="text-[14px] text-govuk-black font-medium truncate flex-1 min-w-0">
                      {urlHostname(url)}
                    </span>

                    {/* Full URL — truncated, desktop only */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-govuk-dark-grey underline hover:no-underline hidden md:block truncate max-w-[160px]"
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
                        className="text-govuk-mid-grey hover:text-govuk-black disabled:opacity-20 px-1 text-[14px] leading-none"
                        title="Move up"
                        aria-label="Move up"
                      >↑</button>
                      <button
                        type="button"
                        onClick={() => moveUrl(i, 1)}
                        disabled={disabled || i === urls.length - 1}
                        className="text-govuk-mid-grey hover:text-govuk-black disabled:opacity-20 px-1 text-[14px] leading-none"
                        title="Move down"
                        aria-label="Move down"
                      >↓</button>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeUrl(i)}
                      disabled={disabled}
                      className="text-govuk-dark-grey hover:text-red-700 disabled:opacity-40 ml-1 text-[15px] leading-none shrink-0"
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
                  className="text-[14px] text-govuk-blue underline hover:no-underline self-start disabled:opacity-50"
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
                    className="border-2 border-govuk-black px-3 py-2 text-[15px] font-mono resize-none w-full focus-visible:outline-none focus-visible:border-govuk-blue"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddMoreSubmit}
                      disabled={!addText.trim()}
                      className="text-[13px] font-bold bg-govuk-black text-white px-3 py-1 hover:bg-govuk-dark-grey disabled:opacity-50"
                    >Add</button>
                    <button
                      type="button"
                      onClick={() => { setShowAddMore(false); setAddText('') }}
                      className="text-[13px] text-govuk-dark-grey underline hover:no-underline"
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
                className="border-2 border-govuk-black px-3 py-2 text-[17px] text-govuk-black font-mono resize-y w-full focus-visible:outline-none focus-visible:ring-0 focus-visible:border-govuk-blue disabled:bg-govuk-light-grey disabled:cursor-not-allowed"
              />
              <p className="text-[13px] text-govuk-dark-grey">
                One URL per line. Supports articles and PDFs. Paste any text and URLs are extracted automatically.
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ─── QuickAdd ─────────────────────────────────────────────────────────────────────

function QuickAdd({
  password,
  onAdd,
  disabled,
  initialUrl = '',
}: {
  password: string
  onAdd: (url: string, section: SectionKey) => void
  disabled: boolean
  initialUrl?: string
}) {
  const [open, setOpen] = useState(!!initialUrl)
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{ section: SectionKey; title: string | null } | null>(null)
  const [overrideSection, setOverrideSection] = useState<SectionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)

  // If a URL is passed from the ?add= param, open automatically
  useEffect(() => {
    if (initialUrl) { setUrl(initialUrl); setOpen(true) }
  }, [initialUrl])

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
        className="text-[14px] text-govuk-blue underline hover:no-underline self-start"
      >
        ✦ Quick Add — AI section suggester
      </button>
    )
  }

  return (
    <div className="border-2 border-govuk-black p-4 flex flex-col gap-3 bg-govuk-light-grey">
      <div className="flex items-center justify-between">
        <p className="font-bold text-[15px] text-govuk-black">Quick Add — AI section suggester</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setSuggestion(null); setError(null) }}
          className="text-[13px] text-govuk-dark-grey underline hover:no-underline"
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
          className="flex-1 border-2 border-govuk-black px-3 py-2 text-[15px] font-mono focus-visible:outline-none focus-visible:border-govuk-blue disabled:bg-white disabled:opacity-70 min-w-0 bg-white"
        />
        <button
          type="button"
          onClick={handleSuggest}
          disabled={disabled || loading || !url.startsWith('http')}
          className="bg-govuk-black text-white font-bold text-[15px] px-4 py-2 hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? '↻ Thinking…' : 'Suggest section'}
        </button>
      </div>

      {error && <p className="text-[14px] text-red-700" role="alert">{error}</p>}

      {added && (
        <p className="text-[14px] text-green-700 font-bold">✓ Added to {SECTION_LABELS[activeSection]}</p>
      )}

      {suggestion && !added && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[14px] text-govuk-black">Suggested section:</span>
          <select
            value={activeSection}
            onChange={e => setOverrideSection(e.target.value as SectionKey)}
            className="border-2 border-govuk-black px-2 py-1.5 text-[14px] text-govuk-black bg-white focus-visible:outline-none focus-visible:border-govuk-blue"
          >
            {SECTION_KEYS.map(k => (
              <option key={k} value={k}>{SECTION_LABELS[k]}</option>
            ))}
          </select>
          {suggestion.title && (
            <span className="text-[13px] text-govuk-dark-grey truncate max-w-xs">— {suggestion.title}</span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className="bg-govuk-black text-white font-bold text-[14px] px-4 py-2 hover:bg-govuk-dark-grey shrink-0"
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
      <h3 className="font-bold text-[16px] text-govuk-black border-b border-govuk-mid-grey pb-1">{label}</h3>
      {summaries.map(({ url, title, publishedDate, imageUrl, summary }) => {
        const isEditing = editingUrl === url
        const isRegenerating = regeneratingUrl === url
        return (
          <div key={url} className="border-l-4 border-govuk-mid-grey pl-3 flex flex-col gap-1.5">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={title ?? ''} className="w-full max-h-40 object-cover rounded mb-1" />
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-[15px] text-govuk-black underline hover:no-underline">
              {title ?? url}
            </a>
            {publishedDate && <p className="text-[13px] text-govuk-dark-grey">Published: {publishedDate}</p>}

            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={4}
                  autoFocus
                  className="border-2 border-govuk-blue px-3 py-2 text-[15px] text-govuk-black resize-y w-full focus-visible:outline-none"
                />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[12px] text-govuk-dark-grey">{editText.length} chars</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { onEdit(url, editText); setEditingUrl(null) }}
                      className="text-[13px] font-bold bg-govuk-black text-white px-3 py-1 hover:bg-govuk-dark-grey">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingUrl(null)}
                      className="text-[13px] text-govuk-dark-grey underline hover:no-underline">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-[15px] text-govuk-black">{summary}</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[12px] text-govuk-dark-grey">{summary.length} chars</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setEditingUrl(url); setEditText(summary) }}
                      className="text-[13px] text-govuk-blue underline hover:no-underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => onRegenerate(url)}
                      disabled={isRegenerating || regeneratingUrl !== null}
                      className="text-[13px] text-govuk-blue underline hover:no-underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">
                      {isRegenerating ? '↻ Regenerating…' : '↻ Regenerate'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-govuk-dark-grey underline hover:no-underline break-all">
              {url}
            </a>
          </div>
        )
      })}
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
      className="border border-govuk-mid-grey bg-govuk-light-grey max-h-48 overflow-y-auto font-mono text-[13px] text-govuk-black p-2 flex flex-col gap-0.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

// ─── SummaryLengthPicker ─────────────────────────────────────────────────────────

function SummaryLengthPicker({ value, onChange, disabled }: {
  value: SummaryLength; onChange: (v: SummaryLength) => void; disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-bold text-[17px] text-govuk-black">Summary length</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {(['brief', 'standard', 'detailed'] as const).map(l => (
          <label key={l} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="summaryLength" value={l} checked={value === l}
              onChange={() => onChange(l)} disabled={disabled}
              className="accent-govuk-black cursor-pointer" />
            <span className="text-[15px] text-govuk-black">{SUMMARY_LENGTH_LABELS[l]}</span>
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
  const [resultSummaries, setResultSummaries] = useState<Record<SectionKey, SectionSummary[]>>({ ...EMPTY_SUMMARIES })
  const [apiError, setApiError] = useState<string | null>(null)
  const [createValidationError, setCreateValidationError] = useState<string | null>(null)

  // ── Regenerate
  const [regeneratingUrl, setRegeneratingUrl] = useState<string | null>(null)

  // ── Session restore
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null)

  // ── Copy as email
  const [copiedEmail, setCopiedEmail] = useState(false)

  // ── Quick Add initial URL (from ?add= query param)
  const [quickAddInitialUrl, setQuickAddInitialUrl] = useState('')

  const passwordRef = useRef<HTMLInputElement>(null)

  // ── Document title
  useEffect(() => {
    if (!authed) document.title = 'Admin sign in — AI This Week'
    else if (result) document.title = 'Issue created — Admin — AI This Week'
    else document.title = 'Admin — AI This Week'
  }, [authed, result])

  // ── Restore auth from sessionStorage + check ?add= param
  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (stored) { setPassword(stored); setAuthed(true) }
    else passwordRef.current?.focus()

    // Read ?add= URL param for bookmarklet support
    try {
      const params = new URLSearchParams(window.location.search)
      const addUrl = params.get('add')
      if (addUrl?.startsWith('http')) setQuickAddInitialUrl(addUrl)
    } catch { /* ignore */ }
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

  // ── Create handler
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
    try {
      const res = await fetch('/api/new-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, sections, includeImages, summaryLength }),
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
          case 'notion':   setCreateLog(p => [...p, `✍️ Creating Notion page…`]); break
          case 'complete':
            setResult({ notionUrl: event.notionUrl, issueNumber: event.issueNumber ?? 0 })
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
  }

  function toggleSection(key: SectionKey) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Render helpers
  function renderSuccessActions(notionUrl: string, summaries: Record<SectionKey, SectionSummary[]>) {
    return (
      <div className="flex flex-wrap gap-3">
        <a href={notionUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-govuk-black text-white font-bold text-[17px] px-5 py-3 hover:bg-govuk-dark-grey no-underline">
          Open in Notion &rarr;
        </a>
        {hasSummaryContent(summaries) && (
          <button type="button" onClick={() => handleCopyEmail(summaries)}
            className="inline-flex items-center gap-2 border-2 border-govuk-black text-govuk-black font-bold text-[17px] px-5 py-3 hover:bg-govuk-light-grey">
            {copiedEmail ? '✓ Copied!' : '📋 Copy as plain text'}
          </button>
        )}
        <button type="button" onClick={handleReset}
          className="inline-flex items-center gap-2 border-2 border-govuk-black text-govuk-black font-bold text-[17px] px-5 py-3 hover:bg-govuk-light-grey">
          Create another issue
        </button>
      </div>
    )
  }

  function renderSummaryPreviews(summaries: Record<SectionKey, SectionSummary[]>) {
    if (!hasSummaryContent(summaries)) return null
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-[22px] font-bold text-govuk-black">Generated summaries</h2>
          <p className="text-[13px] text-govuk-dark-grey">Click Edit or ↻ Regenerate on any summary to modify it.</p>
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
      <div className="max-w-sm">
        <h1 className="text-[32px] font-bold text-govuk-black dark:text-white mb-6">Admin sign in</h1>
        <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="font-bold text-[17px] text-govuk-black dark:text-white">Password</label>
            <input ref={passwordRef} id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} disabled={authLoading} required
              className="border-2 border-govuk-black px-3 py-2 text-[17px] text-govuk-black dark:text-white dark:bg-transparent w-full focus-visible:outline-none focus-visible:border-govuk-blue disabled:bg-govuk-light-grey" />
            {authError && <p className="text-[15px] text-red-700 font-bold" role="alert">{authError}</p>}
          </div>
          <button type="submit" disabled={authLoading || !password}
            className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 self-start hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed">
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  // ── Render: create success ────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="max-w-2xl flex flex-col gap-6">
        <div className="flex justify-end">
          <button onClick={handleSignOut} className="text-[14px] text-govuk-dark-grey underline hover:no-underline">Sign out</button>
        </div>
        <div className="bg-green-50 border-l-4 border-green-700 px-5 py-4">
          <p className="font-bold text-[19px] text-green-900">Issue #{result.issueNumber} created successfully</p>
        </div>
        {renderSuccessActions(result.notionUrl, resultSummaries)}
        {renderSummaryPreviews(resultSummaries)}
      </div>
    )
  }

  // ── Render: main form ─────────────────────────────────────────────────────────

  const isFormBusy = loading

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-[32px] font-bold text-govuk-black">Admin</h1>
          <div className="flex items-center gap-4 mt-2">
            <a href="/admin/bookmarklet" className="text-[14px] text-govuk-blue underline hover:no-underline hidden sm:inline">
              📱 Mobile bookmarklet
            </a>
            <button onClick={handleSignOut} className="text-[14px] text-govuk-dark-grey underline hover:no-underline">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Session restore banner */}
      {savedSession && (
        <div className="bg-govuk-light-grey border-l-4 border-govuk-blue px-4 py-3 flex items-start sm:items-center justify-between gap-4 flex-wrap">
          <p className="text-[15px] text-govuk-black">
            <strong>In-progress issue</strong> from {formatSavedAt(savedSession.savedAt)} — restore your URLs?
          </p>
          <div className="flex gap-4 shrink-0">
            <button onClick={handleRestoreSession} className="text-[14px] font-bold text-govuk-blue underline hover:no-underline">Restore</button>
            <button onClick={handleDismissSession} className="text-[14px] text-govuk-dark-grey underline hover:no-underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* AI notice */}
      <div className="bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3">
        <p className="text-[15px] text-govuk-black">Summaries are AI-generated. Always review before publishing.</p>
      </div>

      {/* Summary length — shared across modes */}
      <SummaryLengthPicker value={summaryLength} onChange={setSummaryLength} disabled={isFormBusy} />

      <p className="text-[17px] text-govuk-dark-grey">
        Issue date: <strong>{nextMonday()}</strong> &middot; Issue number: auto
      </p>

      <label className="flex items-center gap-3 cursor-pointer self-start">
        <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)}
          className="w-5 h-5 border-2 border-govuk-black accent-govuk-black cursor-pointer" />
        <span className="text-[17px] text-govuk-black font-bold">Include images</span>
        <span className="text-[15px] text-govuk-dark-grey">(uses og:image from each article)</span>
      </label>

      {/* Quick Add — adds URLs to the right section textarea below */}
      <QuickAdd
        password={password}
        onAdd={handleQuickAdd}
        disabled={isFormBusy}
        initialUrl={quickAddInitialUrl}
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
          <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
            <p className="text-[15px] text-red-800">{createValidationError}</p>
          </div>
        )}
        {apiError && (
          <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
            <p className="text-[15px] text-red-800 font-bold">Error</p>
            <p className="text-[15px] text-red-800">{apiError}</p>
          </div>
        )}

        <StatusLog items={createLog} />

        <button type="submit" disabled={isFormBusy}
          className="bg-govuk-black text-white font-bold text-[17px] px-5 py-3 self-start hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto">
          {loading ? 'Generating…' : 'Generate Issue'}
        </button>
      </form>
    </div>
  )
}
