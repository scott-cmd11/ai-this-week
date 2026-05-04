'use client'

import { useEffect, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'

interface PublishedIssue {
  id: string
  title: string
  issueDate: string
  issueNumber: number
}

interface DuplicateWarning {
  issueNumber: number
  issueDate: string
  published: boolean
}

type ItemType = 'article' | 'event'

export function AppendToPublishedIssue({ password }: { password: string }) {
  const [open, setOpen] = useState(false)
  const [issues, setIssues] = useState<PublishedIssue[]>([])
  const [issueId, setIssueId] = useState('')
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [type, setType] = useState<ItemType>('article')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<Category>('Canada')
  const [allowOlderSource, setAllowOlderSource] = useState(false)
  const [polishNote, setPolishNote] = useState(true)
  const [eventTitle, setEventTitle] = useState('')
  const [eventWhen, setEventWhen] = useState('')
  const [eventWhere, setEventWhere] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null)
  const [staleBlocked, setStaleBlocked] = useState(false)

  async function loadIssues() {
    setLoadingIssues(true)
    setError(null)
    try {
      const res = await fetch('/api/published-issues', {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load published issues (${res.status}).`)
        return
      }
      const nextIssues = (payload.issues ?? []) as PublishedIssue[]
      setIssues(nextIssues)
      setIssueId(current => current || nextIssues[0]?.id || '')
    } catch {
      setError('Could not load published issues.')
    } finally {
      setLoadingIssues(false)
    }
  }

  useEffect(() => {
    if (open) loadIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function resetItemFields() {
    setUrl('')
    setNote('')
    setEventTitle('')
    setEventWhen('')
    setEventWhere('')
    setEventDescription('')
    setDuplicate(null)
    setStaleBlocked(false)
  }

  async function extractEvent() {
    if (!url.trim().startsWith('http')) {
      setError('Paste an event URL first.')
      return
    }
    setExtracting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, url: url.trim() }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? 'Could not extract event details. You can still fill them manually.')
        return
      }
      setEventTitle(payload.event?.title ?? '')
      setEventWhen(payload.event?.when ?? '')
      setEventWhere(payload.event?.where ?? '')
      setEventDescription(payload.event?.description ?? '')
    } catch {
      setError('Could not extract event details.')
    } finally {
      setExtracting(false)
    }
  }

  async function submit(force = false, overrideOlderSource = false) {
    if (!issueId) {
      setError('Choose a published issue first.')
      return
    }
    if (!url.trim().startsWith('http')) {
      setError('Paste a valid URL first.')
      return
    }
    if (type === 'event' && !eventTitle.trim()) {
      setError('Event title is required.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    setDuplicate(null)
    setStaleBlocked(false)

    const body = type === 'article'
      ? {
          adminPassword: password,
          issueId,
          type,
          url: url.trim(),
          annotation: note.trim() || undefined,
          autoAnnotate: !note.trim(),
          polishAnnotation: !!note.trim() && polishNote,
          category,
          allowOlderSource: allowOlderSource || overrideOlderSource,
          force,
        }
      : {
          adminPassword: password,
          issueId,
          type,
          title: eventTitle.trim(),
          when: eventWhen.trim(),
          where: eventWhere.trim(),
          description: eventDescription.trim(),
          url: url.trim(),
          force,
        }

    try {
      const res = await fetch('/api/append-to-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json()

      if (res.status === 409 && payload.duplicate) {
        setDuplicate(payload.duplicate)
        return
      }
      if (res.status === 409 && payload.error === 'stale_source') {
        setError(payload.message ?? 'This source looks older than the target issue.')
        setStaleBlocked(true)
        return
      }
      if (!res.ok) {
        setError(payload.error ?? `Could not add item (${res.status}).`)
        return
      }

      const issueLabel = `Issue #${payload.issueNumber} (${payload.issueDate})`
      setSuccess(`Added to ${issueLabel}. The public page was refreshed.`)
      resetItemFields()
    } catch {
      setError('Could not add item.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="border border-ws-black/15 bg-ws-white">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ws-page"
        >
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.12em] text-ws-black/70">Published issue updates</p>
            <p className="text-[12px] text-ws-black/55 mt-0.5">
              Add an article or learning event to an issue that is already live.
            </p>
          </div>
          <span className="text-[12px] font-semibold text-ws-accent shrink-0">Open</span>
        </button>
      </div>
    )
  }

  return (
    <section className="border border-ws-black/15 bg-ws-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-ws-black/70">Published issue updates</p>
          <p className="text-[12px] text-ws-black/55 mt-0.5">
            Use this after publishing when you find one more source worth adding. It appends to the selected live issue and refreshes the public page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent"
        >
          Hide
        </button>
      </div>

      {success && <p className="border border-ws-black/15 bg-ws-page px-3 py-2 text-[13px] font-bold">{success}</p>}
      {error && <p className="border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4">
        <div>
          <label htmlFor="published-issue-target" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
            Published issue
          </label>
          <select
            id="published-issue-target"
            value={issueId}
            onChange={e => setIssueId(e.target.value)}
            disabled={loadingIssues || submitting}
            className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          >
            {issues.length === 0 && <option value="">{loadingIssues ? 'Loading issues...' : 'No published issues found'}</option>}
            {issues.map(issue => (
              <option key={issue.id} value={issue.id}>
                Issue #{issue.issueNumber} - {issue.issueDate}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">Item type</span>
          <div className="grid grid-cols-2 border border-ws-black/30">
            {(['article', 'event'] as ItemType[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => { setType(option); resetItemFields() }}
                className={`px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
                  type === option ? 'bg-ws-black text-ws-white' : 'bg-ws-page text-ws-black hover:bg-ws-white'
                }`}
              >
                {option === 'article' ? 'Article' : 'Event'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="append-url" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
          URL
        </label>
        <input
          id="append-url"
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setDuplicate(null); setStaleBlocked(false); setSuccess(null) }}
          disabled={submitting}
          placeholder={type === 'article' ? 'https://source-article...' : 'https://event-or-registration-page...'}
          className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[15px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
        />
      </div>

      {type === 'article' ? (
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div>
            <label htmlFor="append-category" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
              Section
            </label>
            <select
              id="append-category"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              disabled={submitting}
              className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            >
              {CATEGORY_ORDER.map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="append-note" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
              Note <span className="font-normal normal-case tracking-normal text-ws-black/45">(optional)</span>
            </label>
            <textarea
              id="append-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              disabled={submitting}
              placeholder="Leave blank and AI writes the summary."
              className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] leading-[1.45] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            {note.trim() && (
              <label className="flex items-start gap-2 text-[12px] text-ws-black/70">
                <input
                  type="checkbox"
                  checked={polishNote}
                  onChange={e => setPolishNote(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 w-4 h-4 accent-ws-black"
                />
                <span>Polish my note in the AI Today voice.</span>
              </label>
            )}
            <label className="flex items-start gap-2 text-[12px] text-ws-black/70">
              <input
                type="checkbox"
                checked={allowOlderSource}
                onChange={e => setAllowOlderSource(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-4 h-4 accent-ws-black"
              />
              <span>Allow an older publisher date. Leave this off for normal daily news.</span>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={extractEvent}
            disabled={extracting || submitting || !url.trim().startsWith('http')}
            className="self-start border border-ws-black/30 bg-ws-page px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] hover:bg-ws-black hover:text-ws-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {extracting ? 'Extracting...' : 'Extract details'}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={eventTitle} setValue={setEventTitle} disabled={submitting} required />
            <Field label="When" value={eventWhen} setValue={setEventWhen} disabled={submitting} />
            <Field label="Where" value={eventWhere} setValue={setEventWhere} disabled={submitting} />
            <label className="flex flex-col gap-1.5 md:row-span-2">
              <span className="text-[11px] font-black uppercase tracking-[0.1em]">Description</span>
              <textarea
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                disabled={submitting}
                rows={4}
                className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] leading-[1.45] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
              />
            </label>
          </div>
        </div>
      )}

      {duplicate && (
        <div className="border border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
          <p className="text-[13px] text-ws-black leading-snug">
            This URL already appears in Issue #{duplicate.issueNumber} on {duplicate.issueDate}
            {duplicate.published ? ' (published)' : ' (draft)'}. Add it again only if you mean to.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="border border-ws-black bg-ws-accent text-ws-white px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
            >
              Add anyway
            </button>
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="text-[12px] font-medium text-ws-black/60 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {staleBlocked && (
        <button
          type="button"
          onClick={() => submit(false, true)}
          disabled={submitting}
          className="self-start border border-ws-black bg-ws-page px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] hover:bg-ws-black hover:text-ws-white disabled:opacity-50"
        >
          Add with older-date override
        </button>
      )}

      <button
        type="button"
        onClick={() => submit(false)}
        disabled={submitting || loadingIssues || !issueId || !url.trim() || !!duplicate || staleBlocked}
        className="self-start bg-ws-black text-ws-white px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Adding...' : `Add ${type} to published issue`}
      </button>
    </section>
  )
}

function Field({
  label,
  value,
  setValue,
  disabled,
  required = false,
}: {
  label: string
  value: string
  setValue: (value: string) => void
  disabled: boolean
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-black uppercase tracking-[0.1em]">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
      />
    </label>
  )
}
