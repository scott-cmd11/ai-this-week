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

// ─── Sub-components ─────────────────────────────────────────────────────────────

function SectionTextarea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-bold text-[17px] text-govuk-black">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste one URL per line"
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

// ─── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  // Auth state
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Form state
  const [sections, setSections] = useState({
    top: '',
    bright: '',
    tool: '',
    learning: '',
    deep: '',
  })

  // Submission state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiSuccess | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

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
      // (may be another error, but auth passed)
      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  // ── Form submit handler ───────────────────────────────────────────────────────

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
          // Session expired — sign out
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

  // ── Reset ─────────────────────────────────────────────────────────────────────

  function handleReset() {
    setSections({ top: '', bright: '', tool: '', learning: '', deep: '' })
    setResult(null)
    setApiError(null)
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

  // ── Render: success ───────────────────────────────────────────────────────────

  if (result) {
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

  // ── Render: form ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-[32px] font-bold text-govuk-black mb-1">New issue</h1>
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
    </div>
  )
}
