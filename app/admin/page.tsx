'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SectionSummary {
  url: string
  title: string | null
  summary: string
}

type ProgressEvent =
  | { type: 'fetch';      section: string; url: string }
  | { type: 'pdf';        section: string; url: string }
  | { type: 'summarise';  section: string; url: string }
  | { type: 'done_url';   section: string; url: string; summary: string }
  | { type: 'notion';     message: string }
  | { type: 'complete';   notionUrl: string; issueNumber?: number; summaries: Record<string, Array<{ url: string; title: string | null; summary: string }>> }
  | { type: 'error';      message: string }

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

type Mode = 'create' | 'update'

type SectionKey = 'top' | 'bright' | 'tool' | 'learning' | 'deep'

interface CompletedCreate {
  notionUrl: string
  issueNumber: number
  summaries: Record<SectionKey, SectionSummary[]>
}

interface CompletedUpdate {
  notionUrl: string
  summaries: Record<SectionKey, SectionSummary[]>
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function nextMonday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntil)
  return monday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatIssueDateLabel(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function urlHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function countUrls(text: string): number {
  if (!text.trim()) return 0
  return text
    .split(/[\s\n]+/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http')).length
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionTextarea({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  expanded,
  onToggle,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder?: string
  expanded: boolean
  onToggle: () => void
}) {
  const urlCount = countUrls(value)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[17px] text-govuk-black">{label}</span>
          {urlCount > 0 && (
            <span className="text-[12px] font-bold text-white bg-govuk-blue px-1.5 py-0.5 rounded-sm">
              {urlCount} URL{urlCount !== 1 ? 's' : ''}
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
          <textarea
            rows={4}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder ?? 'Paste one URL per line'}
            className="border-2 border-govuk-black px-3 py-2 text-[17px] text-govuk-black font-mono resize-y w-full focus-visible:outline-none focus-visible:ring-0 focus-visible:border-govuk-blue disabled:bg-govuk-light-grey disabled:cursor-not-allowed"
          />
          <p className="text-[15px] text-govuk-dark-grey">
            One URL per line. Supports articles and PDFs.
          </p>
        </>
      )}
    </div>
  )
}

function SummaryPreview({
  label,
  summaries,
}: {
  label: string
  summaries: SectionSummary[]
}) {
  if (summaries.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-bold text-[16px] text-govuk-black">{label}</h3>
      {summaries.map(({ url, title, summary }) => (
        <div key={url} className="border-l-4 border-govuk-mid-grey pl-3 flex flex-col gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[15px] text-govuk-black underline hover:no-underline"
          >
            {title ?? url}
          </a>
          <p className="text-[15px] text-govuk-black">{summary}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-govuk-dark-grey underline hover:no-underline break-all"
          >
            {url}
          </a>
        </div>
      ))}
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex border-2 border-govuk-black self-start" role="group" aria-label="Admin mode">
      <button
        type="button"
        onClick={() => onChange('create')}
        className={`font-bold text-[15px] px-4 py-2 ${
          mode === 'create'
            ? 'bg-govuk-black text-white'
            : 'bg-white text-govuk-black hover:bg-govuk-light-grey'
        }`}
      >
        Create New Issue
      </button>
      <button
        type="button"
        onClick={() => onChange('update')}
        className={`font-bold text-[15px] px-4 py-2 border-l-2 border-govuk-black ${
          mode === 'update'
            ? 'bg-govuk-black text-white'
            : 'bg-white text-govuk-black hover:bg-govuk-light-grey'
        }`}
      >
        Update Existing Issue
      </button>
    </div>
  )
}

function StatusLog({ items }: { items: string[] }) {
  const logRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [items])

  if (items.length === 0) return null

  return (
    <ul
      ref={logRef}
      className="border border-govuk-mid-grey bg-govuk-light-grey max-h-48 overflow-y-auto font-mono text-[13px] text-govuk-black p-2 flex flex-col gap-0.5"
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

// ─── Default section states ──────────────────────────────────────────────────────

const EMPTY_SECTIONS = { top: '', bright: '', tool: '', learning: '', deep: '' }
const ALL_COLLAPSED: Record<SectionKey, boolean> = {
  top: false,
  bright: false,
  tool: false,
  learning: false,
  deep: false,
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  // Auth state
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Mode
  const [mode, setMode] = useState<Mode>('create')

  // Create form state
  const [sections, setSections] = useState({ ...EMPTY_SECTIONS })
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({ ...ALL_COLLAPSED })
  const [loading, setLoading] = useState(false)
  const [createLog, setCreateLog] = useState<string[]>([])
  const [result, setResult] = useState<CompletedCreate | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [createValidationError, setCreateValidationError] = useState<string | null>(null)

  // Update form state
  const [draftIssues, setDraftIssues] = useState<DraftIssue[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [updateSections, setUpdateSections] = useState({ ...EMPTY_SECTIONS })
  const [updateExpandedSections, setUpdateExpandedSections] = useState<Record<SectionKey, boolean>>({ ...ALL_COLLAPSED })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateLog, setUpdateLog] = useState<string[]>([])
  const [updateResult, setUpdateResult] = useState<CompletedUpdate | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateValidationError, setUpdateValidationError] = useState<string | null>(null)

  const passwordRef = useRef<HTMLInputElement>(null)

  // ── Document title ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authed) {
      document.title = 'Admin sign in — AI This Week'
    } else if (mode === 'create' && result) {
      document.title = 'Issue created — Admin — AI This Week'
    } else if (mode === 'update' && updateResult) {
      document.title = 'Issue updated — Admin — AI This Week'
    } else if (mode === 'create') {
      document.title = 'Create Issue — Admin — AI This Week'
    } else {
      document.title = 'Update Issue — Admin — AI This Week'
    }
  }, [authed, mode, result, updateResult])

  // Check sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (stored) {
      setPassword(stored)
      setAuthed(true)
    } else {
      passwordRef.current?.focus()
    }
  }, [])

  // ── Auth handler ──────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    try {
      const res = await fetch('/api/new-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          sections: { top: '', bright: '', tool: '', learning: '', deep: '' },
        }),
      })

      if (res.status === 401) {
        setAuthError('Incorrect password.')
        setAuthLoading(false)
        return
      }

      // Any response other than 401 means the password was accepted
      // Drain the stream so we don't leak it
      try { await res.body?.cancel() } catch { /* ignore */ }

      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────

  function handleSignOut() {
    sessionStorage.removeItem('adminAuth')
    setPassword('')
    setAuthed(false)
    setAuthError('')
  }

  // ── Mode switching ────────────────────────────────────────────────────────────

  function handleModeChange(m: Mode) {
    setMode(m)
    if (m === 'update') {
      loadDraftIssues()
    }
  }

  async function loadDraftIssues() {
    setDraftLoading(true)
    setDraftError(null)
    try {
      const res = await fetch(`/api/draft-issues?password=${encodeURIComponent(password)}`)
      if (res.status === 401) {
        sessionStorage.removeItem('adminAuth')
        setAuthed(false)
        setPassword('')
        setAuthError('Session expired. Please sign in again.')
        return
      }
      const data = await res.json()
      if ('error' in data) {
        setDraftError(data.error as string)
      } else {
        const issues = data.issues as DraftIssue[]
        setDraftIssues(issues)
        if (issues.length > 0) {
          setSelectedIssueId(prev => prev || issues[0].id)
        }
      }
    } catch {
      setDraftError('Network error. Could not load draft issues.')
    } finally {
      setDraftLoading(false)
    }
  }

  // ── Stream reader helper ──────────────────────────────────────────────────────

  async function readStream(
    res: Response,
    onEvent: (event: ProgressEvent) => void
  ): Promise<void> {
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
        try {
          const event = JSON.parse(line.slice(6)) as ProgressEvent
          onEvent(event)
        } catch {
          /* skip malformed */
        }
      }
    }
  }

  // ── Create form handler ───────────────────────────────────────────────────────

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setCreateValidationError(null)

    const hasUrls = Object.values(sections).some(v => v.trim().length > 0)
    if (!hasUrls) {
      setCreateValidationError('Please paste at least one URL before generating.')
      return
    }

    setLoading(true)
    setApiError(null)
    setResult(null)
    setCreateLog([])

    try {
      const res = await fetch('/api/new-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, sections }),
      })

      if (res.status === 401) {
        sessionStorage.removeItem('adminAuth')
        setAuthed(false)
        setPassword('')
        setAuthError('Session expired. Please sign in again.')
        return
      }

      await readStream(res, (event) => {
        switch (event.type) {
          case 'fetch':
            setCreateLog(prev => [...prev, `⏳ Fetching ${urlHostname(event.url)}…`])
            break
          case 'pdf':
            setCreateLog(prev => [...prev, `📄 Extracting PDF text…`])
            break
          case 'summarise':
            setCreateLog(prev => [...prev, `🤖 Summarising…`])
            break
          case 'done_url':
            setCreateLog(prev => [...prev, `✓ Done — ${event.summary.slice(0, 80)}…`])
            break
          case 'notion':
            setCreateLog(prev => [...prev, `✍️ Creating Notion page…`])
            break
          case 'complete':
            setResult({
              notionUrl: event.notionUrl,
              issueNumber: event.issueNumber ?? 0,
              summaries: event.summaries as Record<SectionKey, SectionSummary[]>,
            })
            break
          case 'error':
            setApiError(event.message)
            break
        }
      })
    } catch {
      setApiError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Update form handler ───────────────────────────────────────────────────────

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setUpdateValidationError(null)

    const hasUrls = Object.values(updateSections).some(v => v.trim().length > 0)
    if (!hasUrls) {
      setUpdateValidationError('Please paste at least one URL before generating.')
      return
    }

    setUpdateLoading(true)
    setUpdateError(null)
    setUpdateResult(null)
    setUpdateLog([])

    try {
      const res = await fetch('/api/update-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: selectedIssueId, sections: updateSections }),
      })

      if (res.status === 401) {
        sessionStorage.removeItem('adminAuth')
        setAuthed(false)
        setPassword('')
        setAuthError('Session expired. Please sign in again.')
        return
      }

      await readStream(res, (event) => {
        switch (event.type) {
          case 'fetch':
            setUpdateLog(prev => [...prev, `⏳ Fetching ${urlHostname(event.url)}…`])
            break
          case 'pdf':
            setUpdateLog(prev => [...prev, `📄 Extracting PDF text…`])
            break
          case 'summarise':
            setUpdateLog(prev => [...prev, `🤖 Summarising…`])
            break
          case 'done_url':
            setUpdateLog(prev => [...prev, `✓ Done — ${event.summary.slice(0, 80)}…`])
            break
          case 'notion':
            setUpdateLog(prev => [...prev, `✍️ Appending to Notion page…`])
            break
          case 'complete':
            setUpdateResult({
              notionUrl: event.notionUrl,
              summaries: event.summaries as Record<SectionKey, SectionSummary[]>,
            })
            break
          case 'error':
            setUpdateError(event.message)
            break
        }
      })
    } catch {
      setUpdateError('Network error. Check your connection and try again.')
    } finally {
      setUpdateLoading(false)
    }
  }

  // ── Reset handlers ────────────────────────────────────────────────────────────

  function handleReset() {
    setSections({ ...EMPTY_SECTIONS })
    setExpandedSections({ ...ALL_COLLAPSED })
    setResult(null)
    setApiError(null)
    setCreateLog([])
    setCreateValidationError(null)
  }

  function handleUpdateAddMore() {
    setUpdateSections({ ...EMPTY_SECTIONS })
    setUpdateExpandedSections({ ...ALL_COLLAPSED })
    setUpdateResult(null)
    setUpdateError(null)
    setUpdateLog([])
    setUpdateValidationError(null)
    loadDraftIssues()
  }

  // ── Section toggle helpers ────────────────────────────────────────────────────

  function toggleSection(key: SectionKey) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleUpdateSection(key: SectionKey) {
    setUpdateExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Render: sign-in ───────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="max-w-sm">
        <h1 className="text-[32px] font-bold text-govuk-black mb-6">Admin sign in</h1>
        <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="font-bold text-[17px] text-govuk-black">
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
              className="border-2 border-govuk-black px-3 py-2 text-[17px] text-govuk-black w-full focus-visible:outline-none focus-visible:border-govuk-blue disabled:bg-govuk-light-grey"
            />
            {authError && (
              <p className="text-[15px] text-red-700 font-bold" role="alert">
                {authError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={authLoading || !password}
            className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 self-start hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  // ── Render: create success ────────────────────────────────────────────────────

  if (mode === 'create' && result) {
    const hasSummaries =
      (result.summaries.top?.length ?? 0) > 0 ||
      (result.summaries.bright?.length ?? 0) > 0 ||
      (result.summaries.tool?.length ?? 0) > 0 ||
      (result.summaries.learning?.length ?? 0) > 0 ||
      (result.summaries.deep?.length ?? 0) > 0

    return (
      <div className="max-w-2xl flex flex-col gap-6">
        <div className="flex justify-end">
          <button onClick={handleSignOut} className="text-[14px] text-govuk-dark-grey underline hover:no-underline">
            Sign out
          </button>
        </div>

        <div className="bg-green-50 border-l-4 border-green-700 px-5 py-4">
          <p className="font-bold text-[19px] text-green-900">
            Issue #{result.issueNumber} created successfully
          </p>
        </div>

        <a
          href={result.notionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-govuk-black text-white font-bold text-[17px] px-5 py-3 self-start hover:bg-govuk-dark-grey no-underline"
        >
          Open in Notion &rarr;
        </a>

        {hasSummaries && (
          <div className="flex flex-col gap-5">
            <h2 className="text-[22px] font-bold text-govuk-black border-b-2 border-govuk-black pb-2">
              Generated summaries
            </h2>
            <SummaryPreview label="Top Stories" summaries={result.summaries.top ?? []} />
            <SummaryPreview label="Bright Spot" summaries={result.summaries.bright ?? []} />
            <SummaryPreview label="Tool of the Week" summaries={result.summaries.tool ?? []} />
            <SummaryPreview label="Learning" summaries={result.summaries.learning ?? []} />
            <SummaryPreview label="Deep Dive" summaries={result.summaries.deep ?? []} />
          </div>
        )}

        <button
          onClick={handleReset}
          className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 self-start hover:bg-govuk-dark-grey"
        >
          Create another issue
        </button>
      </div>
    )
  }

  // ── Render: update success ────────────────────────────────────────────────────

  if (mode === 'update' && updateResult) {
    const selectedIssue = draftIssues.find(i => i.id === selectedIssueId)
    const hasSummaries =
      (updateResult.summaries.top?.length ?? 0) > 0 ||
      (updateResult.summaries.bright?.length ?? 0) > 0 ||
      (updateResult.summaries.tool?.length ?? 0) > 0 ||
      (updateResult.summaries.learning?.length ?? 0) > 0 ||
      (updateResult.summaries.deep?.length ?? 0) > 0

    return (
      <div className="max-w-2xl flex flex-col gap-6">
        <div className="flex justify-end">
          <button onClick={handleSignOut} className="text-[14px] text-govuk-dark-grey underline hover:no-underline">
            Sign out
          </button>
        </div>

        <div className="bg-green-50 border-l-4 border-green-700 px-5 py-4">
          <p className="font-bold text-[19px] text-green-900">
            Added to Issue #{selectedIssue?.issueNumber ?? '—'}
          </p>
        </div>

        <a
          href={updateResult.notionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-govuk-black text-white font-bold text-[17px] px-5 py-3 self-start hover:bg-govuk-dark-grey no-underline"
        >
          Open in Notion &rarr;
        </a>

        {hasSummaries && (
          <div className="flex flex-col gap-5">
            <h2 className="text-[22px] font-bold text-govuk-black border-b-2 border-govuk-black pb-2">
              Appended summaries
            </h2>
            <SummaryPreview label="Top Stories" summaries={updateResult.summaries.top ?? []} />
            <SummaryPreview label="Bright Spot" summaries={updateResult.summaries.bright ?? []} />
            <SummaryPreview label="Tool of the Week" summaries={updateResult.summaries.tool ?? []} />
            <SummaryPreview label="Learning" summaries={updateResult.summaries.learning ?? []} />
            <SummaryPreview label="Deep Dive" summaries={updateResult.summaries.deep ?? []} />
          </div>
        )}

        <button
          onClick={handleUpdateAddMore}
          className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 self-start hover:bg-govuk-dark-grey"
        >
          Add more
        </button>
      </div>
    )
  }

  // ── Render: main form ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-[32px] font-bold text-govuk-black">Admin</h1>
          <button
            onClick={handleSignOut}
            className="text-[14px] text-govuk-dark-grey underline hover:no-underline mt-2"
          >
            Sign out
          </button>
        </div>
        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {/* ── Create mode ── */}
      {mode === 'create' && (
        <>
          <div>
            <p className="text-[17px] text-govuk-dark-grey">
              Issue date: <strong>{nextMonday()}</strong> &middot; Issue number: auto
            </p>
          </div>

          <div className="bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3">
            <p className="text-[15px] text-govuk-black">
              Summaries are AI-generated. Always review before publishing.
            </p>
          </div>

          <form onSubmit={handleGenerate} noValidate className="flex flex-col gap-6">
            <SectionTextarea
              label="Top Stories"
              value={sections.top}
              onChange={v => { setSections(s => ({ ...s, top: v })); setCreateValidationError(null) }}
              disabled={loading}
              expanded={expandedSections.top}
              onToggle={() => toggleSection('top')}
            />
            <SectionTextarea
              label="Bright Spot"
              value={sections.bright}
              onChange={v => { setSections(s => ({ ...s, bright: v })); setCreateValidationError(null) }}
              disabled={loading}
              expanded={expandedSections.bright}
              onToggle={() => toggleSection('bright')}
            />
            <SectionTextarea
              label="Tool of the Week"
              value={sections.tool}
              onChange={v => { setSections(s => ({ ...s, tool: v })); setCreateValidationError(null) }}
              disabled={loading}
              expanded={expandedSections.tool}
              onToggle={() => toggleSection('tool')}
            />
            <SectionTextarea
              label="Learning"
              value={sections.learning}
              onChange={v => { setSections(s => ({ ...s, learning: v })); setCreateValidationError(null) }}
              disabled={loading}
              expanded={expandedSections.learning}
              onToggle={() => toggleSection('learning')}
            />
            <SectionTextarea
              label="Deep Dive"
              value={sections.deep}
              onChange={v => { setSections(s => ({ ...s, deep: v })); setCreateValidationError(null) }}
              disabled={loading}
              expanded={expandedSections.deep}
              onToggle={() => toggleSection('deep')}
            />

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

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating…' : 'Generate Issue'}
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── Update mode ── */}
      {mode === 'update' && (
        <>
          <div className="bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3">
            <p className="text-[15px] text-govuk-black">
              Summaries are AI-generated. Always review before publishing.
            </p>
          </div>

          <form onSubmit={handleUpdate} noValidate className="flex flex-col gap-6">
            {/* Draft issue selector */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="draft-issue" className="font-bold text-[17px] text-govuk-black">
                  Select draft issue
                </label>
                {!draftLoading && (
                  <button
                    type="button"
                    onClick={loadDraftIssues}
                    className="text-[14px] text-govuk-blue hover:underline"
                  >
                    ↻ Refresh
                  </button>
                )}
              </div>
              {draftLoading ? (
                <p className="text-[15px] text-govuk-dark-grey animate-pulse">
                  Loading draft issues…
                </p>
              ) : draftError ? (
                <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
                  <p className="text-[15px] text-red-800">{draftError}</p>
                  <button
                    type="button"
                    onClick={loadDraftIssues}
                    className="text-[14px] text-govuk-blue underline hover:no-underline mt-1"
                  >
                    Try again
                  </button>
                </div>
              ) : draftIssues.length === 0 ? (
                <p className="text-[15px] text-govuk-dark-grey">No draft issues found.</p>
              ) : (
                <select
                  id="draft-issue"
                  value={selectedIssueId}
                  onChange={e => setSelectedIssueId(e.target.value)}
                  disabled={updateLoading}
                  className="border-2 border-govuk-black px-3 py-2 text-[17px] text-govuk-black bg-white w-full focus-visible:outline-none focus-visible:border-govuk-blue disabled:bg-govuk-light-grey disabled:cursor-not-allowed"
                >
                  {draftIssues.map(issue => (
                    <option key={issue.id} value={issue.id}>
                      Issue #{issue.issueNumber} — {formatIssueDateLabel(issue.issueDate)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Section textareas — only show when an issue is selected */}
            {draftIssues.length > 0 && (
              <>
                <SectionTextarea
                  label="Top Stories"
                  value={updateSections.top}
                  onChange={v => { setUpdateSections(s => ({ ...s, top: v })); setUpdateValidationError(null) }}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                  expanded={updateExpandedSections.top}
                  onToggle={() => toggleUpdateSection('top')}
                />
                <SectionTextarea
                  label="Bright Spot"
                  value={updateSections.bright}
                  onChange={v => { setUpdateSections(s => ({ ...s, bright: v })); setUpdateValidationError(null) }}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                  expanded={updateExpandedSections.bright}
                  onToggle={() => toggleUpdateSection('bright')}
                />
                <SectionTextarea
                  label="Tool of the Week"
                  value={updateSections.tool}
                  onChange={v => { setUpdateSections(s => ({ ...s, tool: v })); setUpdateValidationError(null) }}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                  expanded={updateExpandedSections.tool}
                  onToggle={() => toggleUpdateSection('tool')}
                />
                <SectionTextarea
                  label="Learning"
                  value={updateSections.learning}
                  onChange={v => { setUpdateSections(s => ({ ...s, learning: v })); setUpdateValidationError(null) }}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                  expanded={updateExpandedSections.learning}
                  onToggle={() => toggleUpdateSection('learning')}
                />
                <SectionTextarea
                  label="Deep Dive"
                  value={updateSections.deep}
                  onChange={v => { setUpdateSections(s => ({ ...s, deep: v })); setUpdateValidationError(null) }}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                  expanded={updateExpandedSections.deep}
                  onToggle={() => toggleUpdateSection('deep')}
                />

                {updateValidationError && (
                  <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
                    <p className="text-[15px] text-red-800">{updateValidationError}</p>
                  </div>
                )}

                {updateError && (
                  <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
                    <p className="text-[15px] text-red-800 font-bold">Error</p>
                    <p className="text-[15px] text-red-800">{updateError}</p>
                  </div>
                )}

                <StatusLog items={updateLog} />

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={updateLoading || !selectedIssueId}
                    className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateLoading ? 'Adding…' : 'Add to Issue'}
                  </button>
                </div>
              </>
            )}
          </form>
        </>
      )}
    </div>
  )
}
