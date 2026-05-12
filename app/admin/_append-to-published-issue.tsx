'use client'

import { useEffect, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'

export interface PublishedIssue {
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

interface IssueMemoryWarning {
  level: 'likely_same_story' | 'related_topic'
  message: string
  matchedTitle: string
  issueNumber?: number
  issueDate?: string
  sharedSignals?: string[]
  similarity: number
}

type ItemType = 'article' | 'event'

export function AppendToPublishedIssue({
  password,
  defaultOpen = false,
  lockedOpen = false,
  issues: providedIssues,
  issueId: providedIssueId,
  onIssueIdChange,
  hideIssuePicker = false,
  onAppended,
}: {
  password: string
  defaultOpen?: boolean
  lockedOpen?: boolean
  issues?: PublishedIssue[]
  issueId?: string
  onIssueIdChange?: (issueId: string) => void
  hideIssuePicker?: boolean
  onAppended?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen || lockedOpen)
  const [internalIssues, setInternalIssues] = useState<PublishedIssue[]>([])
  const [internalIssueId, setInternalIssueId] = useState('')
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
  const [memoryWarnings, setMemoryWarnings] = useState<IssueMemoryWarning[]>([])
  const [staleBlocked, setStaleBlocked] = useState(false)
  const issues = providedIssues ?? internalIssues
  const issueId = providedIssueId ?? internalIssueId
  const setIssueId = onIssueIdChange ?? setInternalIssueId

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
      setInternalIssues(nextIssues)
      if (!issueId && nextIssues[0]?.id) setIssueId(nextIssues[0].id)
    } catch {
      setError('Could not load published issues.')
    } finally {
      setLoadingIssues(false)
    }
  }

  useEffect(() => {
    if (open && !providedIssues) loadIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providedIssues])

  function resetItemFields() {
    setUrl('')
    setNote('')
    setEventTitle('')
    setEventWhen('')
    setEventWhere('')
    setEventDescription('')
    setDuplicate(null)
    setMemoryWarnings([])
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
    setMemoryWarnings([])
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
      if (res.status === 409 && payload.error === 'issue_memory') {
        setMemoryWarnings(payload.warnings ?? [])
        setError(payload.message ?? 'This looks similar to something from a recent issue.')
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
      onAppended?.()
    } catch {
      setError('Could not add item.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open && !lockedOpen) {
    return (
      <div className="admin-subpanel bg-ws-white">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ws-page"
        >
          <div>
            <p className="admin-eyebrow">Published issue updates</p>
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
    <section className="admin-subpanel bg-ws-white p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="admin-eyebrow">Published issue updates</p>
          <p className="text-[12px] text-ws-black/55 mt-0.5">
            Use this after publishing when you find one more source worth adding. It appends to the selected live issue and refreshes the public page.
          </p>
        </div>
        {!lockedOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent"
          >
            Hide
          </button>
        )}
      </div>

      {success && <p className="admin-notice px-3 py-2">{success}</p>}
      {error && <p className="admin-notice admin-danger-notice px-3 py-2">{error}</p>}

      <div className={hideIssuePicker ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4'}>
        {!hideIssuePicker && (
          <div>
            <label htmlFor="published-issue-target" className="admin-field-label">
              Published issue
            </label>
            <select
              id="published-issue-target"
              value={issueId}
              onChange={e => setIssueId(e.target.value)}
              disabled={loadingIssues || submitting}
              className="admin-input px-3 py-2.5 font-semibold"
            >
              {issues.length === 0 && <option value="">{loadingIssues ? 'Loading issues...' : 'No published issues found'}</option>}
              {issues.map(issue => (
                <option key={issue.id} value={issue.id}>
                  Issue #{issue.issueNumber} - {issue.issueDate}
                </option>
              ))}
            </select>
          </div>
        )}
        {hideIssuePicker && !issueId && (
          <p className="admin-notice px-3 py-2">
            Choose a published issue above before adding a late article or event.
          </p>
        )}

        <div>
          <span className="admin-field-label">Item type</span>
          <div className="admin-segmented grid grid-cols-2">
            {(['article', 'event'] as ItemType[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => { setType(option); resetItemFields() }}
                className={`px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                  type === option ? 'bg-ws-black text-ws-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-white hover:text-ws-black'
                }`}
              >
                {option === 'article' ? 'Article' : 'Event'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="append-url" className="admin-field-label">
          URL
        </label>
        <input
          id="append-url"
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setDuplicate(null); setMemoryWarnings([]); setStaleBlocked(false); setSuccess(null) }}
          disabled={submitting}
          placeholder={type === 'article' ? 'https://source-article...' : 'https://event-or-registration-page...'}
          className="admin-input px-3 py-2.5 font-mono"
        />
      </div>

      {type === 'article' ? (
        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div>
            <label htmlFor="append-category" className="admin-field-label">
              Section
            </label>
            <select
              id="append-category"
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              disabled={submitting}
              className="admin-input px-3 py-2.5 font-semibold"
            >
              {CATEGORY_ORDER.map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="append-note" className="admin-field-label">
              Note <span className="font-normal normal-case tracking-normal text-ws-black/45">(optional)</span>
            </label>
            <textarea
              id="append-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              disabled={submitting}
              placeholder="Leave blank and AI writes the summary."
              className="admin-input px-3 py-2.5 leading-[1.45]"
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
            className="admin-button-secondary self-start px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {extracting ? 'Extracting...' : 'Extract details'}
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title" value={eventTitle} setValue={setEventTitle} disabled={submitting} required />
            <Field label="When" value={eventWhen} setValue={setEventWhen} disabled={submitting} />
            <Field label="Where" value={eventWhere} setValue={setEventWhere} disabled={submitting} />
            <label className="flex flex-col gap-1.5 md:row-span-2">
              <span className="admin-field-label">Description</span>
              <textarea
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                disabled={submitting}
                rows={4}
                className="admin-input px-3 py-2.5 leading-[1.45]"
              />
            </label>
          </div>
        </div>
      )}

      {duplicate && (
        <div className="admin-notice border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
          <p className="text-[13px] text-ws-black leading-snug">
            This URL already appears in Issue #{duplicate.issueNumber} on {duplicate.issueDate}
            {duplicate.published ? ' (published)' : ' (draft)'}. Add it again only if you mean to.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="admin-button-primary px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
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

      {memoryWarnings.length > 0 && (
        <div className="admin-notice border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-ws-accent">
              Issue memory warning
            </p>
            <p className="mt-1 text-[13px] text-ws-black/75">
              This may repeat a recent article or topic. Add it only if the angle is meaningfully different.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {memoryWarnings.map((warning, index) => (
              <li key={`${warning.matchedTitle}-${index}`} className="text-[13px] leading-snug text-ws-black">
                <strong>{warning.level === 'likely_same_story' ? 'Likely same story' : 'Related topic'}:</strong>{' '}
                {warning.message}
                {warning.sharedSignals && warning.sharedSignals.length > 0 && (
                  <span className="block text-[12px] text-ws-black/55">
                    Shared signals: {warning.sharedSignals.join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="admin-button-primary px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
            >
              Add anyway
            </button>
            <button
              type="button"
              onClick={() => { setMemoryWarnings([]); setError(null) }}
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
          className="admin-button-secondary self-start px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
        >
          Add with older-date override
        </button>
      )}

      <button
        type="button"
        onClick={() => submit(false)}
        disabled={submitting || loadingIssues || !issueId || !url.trim() || !!duplicate || memoryWarnings.length > 0 || staleBlocked}
        className="admin-button-primary self-start px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:opacity-40 disabled:cursor-not-allowed"
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
      <span className="admin-field-label">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={disabled}
        className="admin-input px-3 py-2.5"
      />
    </label>
  )
}
