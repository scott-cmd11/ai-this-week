'use client'

import { useState, useEffect } from 'react'

interface DraftIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

export function PublishDrafts({ password }: { password: string }) {
  const [drafts, setDrafts] = useState<DraftIssue[] | null>(null)
  const [open, setOpen] = useState(false)
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
      const res = await fetch('/api/draft-issues', {
        headers: { 'x-admin-password': password },
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const data = await res.json()
      const todayIso = new Date().toISOString().split('T')[0]
      const issues = ((data.issues ?? []) as DraftIssue[]).filter(d => d.issueDate !== todayIso)
      setDrafts(issues)
      if (issues.length > 0) setOpen(true)
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
    if (!window.confirm(`Delete "${title}"? This removes the draft from the issue store.`)) return
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
      setMessage(`✓ Deleted "${title}".`)
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
        `/api/issue-summaries?pageId=${encodeURIComponent(justPublished.id)}`,
        { headers: { 'x-admin-password': password } }
      )
      if (!summariesRes.ok) throw new Error('Could not load issue content.')
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

  if (!open) {
    return (
      <div className="border-[3px] border-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-page"
        >
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Older unpublished drafts</p>
            <p className="text-[12px] text-ws-black/50 mt-0.5">Drafts from previous days you didn&apos;t finish. Today&apos;s draft is published from the panel above. Expands automatically if any older drafts exist.</p>
          </div>
          <span className="text-[12px] font-medium text-ws-black/50 shrink-0">+ Show</span>
        </button>
      </div>
    )
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Older unpublished drafts</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Drafts from previous days you didn&apos;t finish. Today&apos;s draft is published from the panel above.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadDrafts}
            disabled={loading}
            className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent disabled:opacity-50"
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent"
          >
            Hide
          </button>
        </div>
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
            return (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 flex-wrap border-[2px] border-ws-black/30 px-3 py-2 hover:bg-ws-page"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold truncate group-hover:text-ws-accent group-hover:underline">
                    {draft.title} ↗
                  </p>
                  <p className="text-[12px] text-ws-black/70 uppercase tracking-wide">
                    Issue {draft.issueNumber} · {draft.issueDate}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleArchive(draft.id, draft.title)}
                    disabled={publishing !== null || archiving !== null}
                    className="border-[2px] border-ws-black bg-ws-white text-ws-black font-bold uppercase tracking-wide text-[12px] px-2 py-1.5 hover:bg-ws-page disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete draft"
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
        <p className="text-[12px] text-ws-black/70">Fixed a typo on an already-published issue?</p>
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
