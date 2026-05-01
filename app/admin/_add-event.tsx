'use client'

import { useState, useRef } from 'react'

export function AddEvent({ password }: { password: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [where, setWhere] = useState('')
  const [description, setDescription] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eventDuplicate, setEventDuplicate] = useState<{
    issueNumber: number
    issueDate: string
    published: boolean
  } | null>(null)

  const extractTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastExtractedUrlRef = useRef<string | null>(null)

  async function runExtraction(targetUrl: string) {
    if (lastExtractedUrlRef.current === targetUrl) return
    lastExtractedUrlRef.current = targetUrl
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, url: targetUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setExtractError(data.error ?? 'Extraction failed — you can still fill the fields manually.')
        setExtracted(true)
        return
      }
      const ev = data.event
      setTitle(ev.title || '')
      setWhen(ev.when || '')
      setWhere(ev.where || '')
      setDescription(ev.description || '')
      setExtracted(true)
    } catch {
      setExtractError('Network error during extraction. Fill the fields manually if you want.')
      setExtracted(true)
    } finally {
      setExtracting(false)
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value)
    setSuccess(null)
    setSubmitError(null)
    setEventDuplicate(null)
    if (extractTimer.current) clearTimeout(extractTimer.current)
    const trimmed = value.trim()
    if (!trimmed.startsWith('http')) {
      lastExtractedUrlRef.current = null
      return
    }
    extractTimer.current = setTimeout(() => {
      runExtraction(trimmed)
    }, 600)
  }

  async function submitEvent(force: boolean) {
    setSubmitError(null)
    setSuccess(null)
    setSubmitting(true)
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
          force,
        }),
      })
      const data = await res.json()
      if (res.status === 409 && data.duplicate) {
        setEventDuplicate(data.duplicate)
        return
      }
      if (!res.ok) { setSubmitError(data.error ?? `Error ${res.status}`); return }

      setSuccess('✓ Event added to today’s draft (under “Upcoming”).')
      setUrl(''); setTitle(''); setWhen(''); setWhere(''); setDescription('')
      setExtracted(false)
      setEventDuplicate(null)
      lastExtractedUrlRef.current = null
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
    } catch {
      setSubmitError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !url.trim().startsWith('http')) { setSubmitError('Paste a valid event URL first.'); return }
    if (!title.trim()) { setSubmitError('Title is required (AI extraction may have missed it — type one in).'); return }
    setEventDuplicate(null)
    await submitEvent(false)
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
            <p className="text-[12px] text-ws-black/50 mt-0.5">Drop an event URL — AI extracts the details for you. Goes under “Upcoming” in today’s issue.</p>
          </div>
          <span className="text-[12px] font-medium text-ws-black/50 shrink-0">+ Show</span>
        </button>
      </div>
    )
  }

  const inlineFieldClass =
    "w-full bg-transparent border-0 border-b-[2px] border-transparent " +
    "hover:border-ws-black/15 focus:border-ws-accent focus:outline-none " +
    "px-0 py-1 placeholder:text-ws-black/30 placeholder:italic disabled:opacity-60"

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add a learning event</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Drop an event URL. AI extracts the details — review, tweak if needed, confirm.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent shrink-0"
        >
          Hide
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="event-url" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Event URL <span className="text-ws-accent" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="event-url"
              type="url"
              required
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="Paste event or registration URL — AI extracts the rest"
              disabled={submitting}
              className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 pr-12 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
            />
            {extracting && (
              <span
                aria-label="Extracting event details"
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-4 h-4 border-2 border-ws-black border-t-transparent rounded-full animate-spin"
              />
            )}
          </div>
          {extractError && (
            <p className="text-[12px] text-ws-accent mt-1.5">{extractError}</p>
          )}
        </div>

        {extracted && (
          <div className="border-[2px] border-ws-black/20 bg-ws-page p-4 flex flex-col gap-4">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent/80">
              ❆ AI extracted — click any field to edit
            </p>

            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-ws-black/50 mb-0.5">Title</span>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="(missing — type a title)"
                disabled={submitting}
                aria-label="Event title"
                className={`${inlineFieldClass} text-[18px] font-bold leading-snug`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-ws-black/50 mb-0.5">When</span>
                <input
                  type="text"
                  value={when}
                  onChange={e => setWhen(e.target.value)}
                  placeholder="(missing — e.g. May 7, 2pm ET)"
                  disabled={submitting}
                  aria-label="When"
                  className={`${inlineFieldClass} text-[14px]`}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-ws-black/50 mb-0.5">Where</span>
                <input
                  type="text"
                  value={where}
                  onChange={e => setWhere(e.target.value)}
                  placeholder="(missing — e.g. Virtual)"
                  disabled={submitting}
                  aria-label="Where"
                  className={`${inlineFieldClass} text-[14px]`}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-ws-black/50 mb-0.5">About</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="(optional — what it’s about, who it’s for)"
                rows={2}
                disabled={submitting}
                aria-label="About"
                className={`${inlineFieldClass} text-[14px] leading-snug resize-y`}
              />
            </div>
          </div>
        )}

        {submitError && (
          <div role="alert" className="border-[3px] border-ws-black bg-red-50 px-3 py-2 text-[14px] font-bold text-red-700">
            {submitError}
          </div>
        )}
        {success && (
          <p className="text-[14px] font-bold text-ws-black">{success}</p>
        )}

        {eventDuplicate && (
          <div role="alert" className="border-[3px] border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
            <p className="text-[14px] text-ws-black leading-snug">
              <span aria-hidden="true">⚠</span> This URL was already added to{' '}
              <strong>Issue #{eventDuplicate.issueNumber}</strong> on{' '}
              <strong>{eventDuplicate.issueDate}</strong>{' '}
              ({eventDuplicate.published ? 'published' : 'draft'}). Add it again only if you mean to.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => submitEvent(true)}
                disabled={submitting}
                className="border-[2px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[12px] px-3 py-1.5 hover:bg-ws-accent-hover disabled:opacity-50"
              >
                Add anyway
              </button>
              <button
                type="button"
                onClick={() => setEventDuplicate(null)}
                className="text-[12px] font-medium text-ws-black/60 hover:underline hover:text-ws-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || extracting || !url.trim() || !title.trim() || !!eventDuplicate}
          className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          title={!url.trim() ? 'Paste a URL first' : !title.trim() ? 'Title required' : ''}
        >
          {submitting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Adding event…
            </>
          ) : (
            '+ Add event to today’s issue'
          )}
        </button>
      </form>
    </div>
  )
}
