'use client'

import { useState, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SectionSummary {
  url: string
  summary: string
}

interface ApiSuccess {
  notionUrl: string
  issueNumber: number
  summaries: {
    top: SectionSummary[]
    bright: SectionSummary[]
    tool: SectionSummary[]
    learning: SectionSummary[]
    deep: SectionSummary[]
  }
}

interface ApiError {
  error: string
}

type ApiResult = ApiSuccess | ApiError

function isApiError(result: ApiResult): result is ApiError {
  return 'error' in result
}

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

interface UpdateApiSuccess {
  success: true
  appended: {
    top: SectionSummary[]
    bright: SectionSummary[]
    tool: SectionSummary[]
    learning: SectionSummary[]
    deep: SectionSummary[]
  }
}

type UpdateApiResult = UpdateApiSuccess | ApiError

function isUpdateApiError(result: UpdateApiResult): result is ApiError {
  return 'error' in result
}

type Mode = 'create' | 'update'

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

function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, '')}`
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionTextarea({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-bold text-[17px] text-govuk-black">{label}</label>
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
      {summaries.map(({ url, summary }) => (
        <div key={url} className="border-l-4 border-govuk-mid-grey pl-3 flex flex-col gap-1">
          <p className="text-[15px] text-govuk-black">{summary}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] text-govuk-blue underline hover:no-underline break-all"
          >
            {url}
          </a>
        </div>
      ))}
    </div>
  )
}

// ─── Mode toggle ─────────────────────────────────────────────────────────────────

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
  const [sections, setSections] = useState({
    top: '',
    bright: '',
    tool: '',
    learning: '',
    deep: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiSuccess | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Update form state
  const [draftIssues, setDraftIssues] = useState<DraftIssue[]>([])
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [updateSections, setUpdateSections] = useState({
    top: '',
    bright: '',
    tool: '',
    learning: '',
    deep: '',
  })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateApiSuccess | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const passwordRef = useRef<HTMLInputElement>(null)

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
      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Mode switching ────────────────────────────────────────────────────────────

  function handleModeChange(m: Mode) {
    setMode(m)
    if (m === 'update' && draftIssues.length === 0 && !draftLoading) {
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
        setDraftIssues(data.issues as DraftIssue[])
        if ((data.issues as DraftIssue[]).length > 0) {
          setSelectedIssueId((data.issues as DraftIssue[])[0].id)
        }
      }
    } catch {
      setDraftError('Network error. Could not load draft issues.')
    } finally {
      setDraftLoading(false)
    }
  }

  // ── Create form handler ───────────────────────────────────────────────────────

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setApiError(null)
    setResult(null)

    try {
      const res = await fetch('/api/new-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, sections }),
      })

      const data: ApiResult = await res.json()

      if (isApiError(data)) {
        if (res.status === 401) {
          sessionStorage.removeItem('adminAuth')
          setAuthed(false)
          setPassword('')
          setAuthError('Session expired. Please sign in again.')
          return
        }
        setApiError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setApiError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Update form handler ───────────────────────────────────────────────────────

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setUpdateLoading(true)
    setUpdateError(null)
    setUpdateResult(null)

    try {
      const res = await fetch('/api/update-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: selectedIssueId, sections: updateSections }),
      })

      const data: UpdateApiResult = await res.json()

      if (isUpdateApiError(data)) {
        if (res.status === 401) {
          sessionStorage.removeItem('adminAuth')
          setAuthed(false)
          setPassword('')
          setAuthError('Session expired. Please sign in again.')
          return
        }
        setUpdateError(data.error)
      } else {
        setUpdateResult(data)
      }
    } catch {
      setUpdateError('Network error. Check your connection and try again.')
    } finally {
      setUpdateLoading(false)
    }
  }

  // ── Reset handlers ────────────────────────────────────────────────────────────

  function handleReset() {
    setSections({ top: '', bright: '', tool: '', learning: '', deep: '' })
    setResult(null)
    setApiError(null)
  }

  function handleUpdateAddMore() {
    setUpdateSections({ top: '', bright: '', tool: '', learning: '', deep: '' })
    setUpdateResult(null)
    setUpdateError(null)
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
      result.summaries.top.length > 0 ||
      result.summaries.bright.length > 0 ||
      result.summaries.tool.length > 0 ||
      result.summaries.learning.length > 0 ||
      result.summaries.deep.length > 0

    return (
      <div className="max-w-2xl flex flex-col gap-6">
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
            <SummaryPreview label="Top Stories" summaries={result.summaries.top} />
            <SummaryPreview label="Bright Spot" summaries={result.summaries.bright} />
            <SummaryPreview label="Tool of the Week" summaries={result.summaries.tool} />
            <SummaryPreview label="Learning" summaries={result.summaries.learning} />
            <SummaryPreview label="Deep Dive" summaries={result.summaries.deep} />
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
      updateResult.appended.top.length > 0 ||
      updateResult.appended.bright.length > 0 ||
      updateResult.appended.tool.length > 0 ||
      updateResult.appended.learning.length > 0 ||
      updateResult.appended.deep.length > 0

    return (
      <div className="max-w-2xl flex flex-col gap-6">
        <div className="bg-green-50 border-l-4 border-green-700 px-5 py-4">
          <p className="font-bold text-[19px] text-green-900">
            Added to Issue #{selectedIssue?.issueNumber ?? '—'}
          </p>
        </div>

        <a
          href={notionUrl(selectedIssueId)}
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
            <SummaryPreview label="Top Stories" summaries={updateResult.appended.top} />
            <SummaryPreview label="Bright Spot" summaries={updateResult.appended.bright} />
            <SummaryPreview label="Tool of the Week" summaries={updateResult.appended.tool} />
            <SummaryPreview label="Learning" summaries={updateResult.appended.learning} />
            <SummaryPreview label="Deep Dive" summaries={updateResult.appended.deep} />
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
        <h1 className="text-[32px] font-bold text-govuk-black mb-4">Admin</h1>
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
              onChange={v => setSections(s => ({ ...s, top: v }))}
              disabled={loading}
            />
            <SectionTextarea
              label="Bright Spot"
              value={sections.bright}
              onChange={v => setSections(s => ({ ...s, bright: v }))}
              disabled={loading}
            />
            <SectionTextarea
              label="Tool of the Week"
              value={sections.tool}
              onChange={v => setSections(s => ({ ...s, tool: v }))}
              disabled={loading}
            />
            <SectionTextarea
              label="Learning"
              value={sections.learning}
              onChange={v => setSections(s => ({ ...s, learning: v }))}
              disabled={loading}
            />
            <SectionTextarea
              label="Deep Dive"
              value={sections.deep}
              onChange={v => setSections(s => ({ ...s, deep: v }))}
              disabled={loading}
            />

            {apiError && (
              <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
                <p className="text-[15px] text-red-800 font-bold">Error</p>
                <p className="text-[15px] text-red-800">{apiError}</p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating…' : 'Generate Issue'}
              </button>
              {loading && (
                <p className="text-[15px] text-govuk-dark-grey animate-pulse">
                  Generating summaries and creating Notion page…
                </p>
              )}
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
              <label htmlFor="draft-issue" className="font-bold text-[17px] text-govuk-black">
                Select draft issue
              </label>
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
                  onChange={v => setUpdateSections(s => ({ ...s, top: v }))}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                />
                <SectionTextarea
                  label="Bright Spot"
                  value={updateSections.bright}
                  onChange={v => setUpdateSections(s => ({ ...s, bright: v }))}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                />
                <SectionTextarea
                  label="Tool of the Week"
                  value={updateSections.tool}
                  onChange={v => setUpdateSections(s => ({ ...s, tool: v }))}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                />
                <SectionTextarea
                  label="Learning"
                  value={updateSections.learning}
                  onChange={v => setUpdateSections(s => ({ ...s, learning: v }))}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                />
                <SectionTextarea
                  label="Deep Dive"
                  value={updateSections.deep}
                  onChange={v => setUpdateSections(s => ({ ...s, deep: v }))}
                  disabled={updateLoading}
                  placeholder="Paste one URL per line — will be appended to existing content"
                />

                {updateError && (
                  <div className="bg-red-50 border-l-4 border-red-700 px-4 py-3" role="alert">
                    <p className="text-[15px] text-red-800 font-bold">Error</p>
                    <p className="text-[15px] text-red-800">{updateError}</p>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={updateLoading || !selectedIssueId}
                    className="bg-govuk-black text-white font-bold text-[17px] px-5 py-2 hover:bg-govuk-dark-grey disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updateLoading ? 'Adding…' : 'Add to Issue'}
                  </button>
                  {updateLoading && (
                    <p className="text-[15px] text-govuk-dark-grey animate-pulse">
                      Generating summaries and appending to Notion…
                    </p>
                  )}
                </div>
              </>
            )}
          </form>
        </>
      )}
    </div>
  )
}
