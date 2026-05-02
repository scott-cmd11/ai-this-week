'use client'

import { useState } from 'react'

interface PublishedIssue {
  id: string
  issueNumber: number
  issueDate: string
  title: string
}

export function GenerateEmailFromPublished({ password }: { password: string }) {
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
      const res = await fetch('/api/published-issues', {
        headers: { 'x-admin-password': password },
      })
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
        `/api/issue-summaries?pageId=${encodeURIComponent(issue.id)}`,
        { headers: { 'x-admin-password': password } }
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
