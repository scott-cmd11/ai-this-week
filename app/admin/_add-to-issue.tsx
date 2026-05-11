'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'

interface IssueOption {
  id: string
  title: string
  issueDate: string
  issueNumber: number
  published: boolean
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

type DestinationMode = 'existing' | 'date'
type ItemType = 'article' | 'event'

function localIsoDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function issueLabel(issue: IssueOption) {
  return `Issue #${issue.issueNumber} - ${issue.issueDate} (${issue.published ? 'published' : 'draft'})`
}

export function AddToIssue({ password }: { password: string }) {
  const [issues, setIssues] = useState<IssueOption[]>([])
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [destinationMode, setDestinationMode] = useState<DestinationMode>('existing')
  const [issueId, setIssueId] = useState('')
  const [issueDate, setIssueDate] = useState(localIsoDate(1))
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

  const selectedIssue = issues.find(issue => issue.id === issueId) ?? null
  const canSubmit = destinationMode === 'existing' ? !!issueId : /^\d{4}-\d{2}-\d{2}$/.test(issueDate)

  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [issues],
  )

  async function loadIssues() {
    setLoadingIssues(true)
    setError(null)
    try {
      const [draftRes, publishedRes] = await Promise.all([
        fetch('/api/draft-issues', { headers: { 'x-admin-password': password } }),
        fetch('/api/published-issues', { headers: { 'x-admin-password': password } }),
      ])
      const [draftPayload, publishedPayload] = await Promise.all([draftRes.json(), publishedRes.json()])
      if (!draftRes.ok) throw new Error(draftPayload.error ?? `Draft issue error ${draftRes.status}`)
      if (!publishedRes.ok) throw new Error(publishedPayload.error ?? `Published issue error ${publishedRes.status}`)

      const drafts = ((draftPayload.issues ?? []) as IssueOption[]).map(issue => ({ ...issue, published: false }))
      const published = ((publishedPayload.issues ?? []) as IssueOption[]).map(issue => ({ ...issue, published: true }))
      const byId = new Map<string, IssueOption>()
      for (const issue of [...drafts, ...published]) byId.set(issue.id, issue)
      const nextIssues = [...byId.values()]
      setIssues(nextIssues)
      setIssueId(current => current || nextIssues.sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load issues.')
    } finally {
      setLoadingIssues(false)
    }
  }

  useEffect(() => {
    loadIssues()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

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
    if (!canSubmit) {
      setError('Choose an issue or enter an issue date first.')
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

    const target =
      destinationMode === 'existing'
        ? { issueId }
        : { issueDate }

    const body = type === 'article'
      ? {
          adminPassword: password,
          type,
          url: url.trim(),
          annotation: note.trim() || undefined,
          autoAnnotate: !note.trim(),
          polishAnnotation: !!note.trim() && polishNote,
          category,
          allowOlderSource: allowOlderSource || overrideOlderSource,
          force,
          ...target,
        }
      : {
          adminPassword: password,
          type,
          title: eventTitle.trim(),
          when: eventWhen.trim(),
          where: eventWhere.trim(),
          description: eventDescription.trim(),
          url: url.trim(),
          force,
          ...target,
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

      const targetIssue = payload.issue ?? selectedIssue
      const label = targetIssue
        ? `Issue #${targetIssue.issueNumber} (${targetIssue.issueDate})`
        : 'the selected issue'
      setSuccess(`Added ${type === 'article' ? 'article' : 'event'} to ${label}.`)
      resetItemFields()
      await loadIssues()
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
    } catch {
      setError('Could not add item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="add-to-issue" className="admin-panel flex flex-col gap-5 bg-ws-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-start">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add to issue</p>
          <h3 className="mt-2 font-[family-name:var(--font-display)] text-[34px] font-black leading-[0.95] tracking-tight">
            Issue append desk
          </h3>
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.55] text-ws-black/65">
            Add an article or learning event to a draft, a published issue, or a future issue date without touching the daily candidate review flow.
          </p>
        </div>

        <div className="rounded-[0.65rem] border border-ws-border bg-ws-page/70 p-3">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/50">Use this when</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-snug text-ws-black/65">
            <li>You find one more source for an already drafted issue.</li>
            <li>You need a late add to a published issue.</li>
            <li>You want to park something for an upcoming issue.</li>
          </ul>
        </div>
      </div>

      {success && <p className="border border-ws-black/15 bg-ws-page px-3 py-2 text-[13px] font-bold">{success}</p>}
      {error && <p className="border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">{error}</p>}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">Destination</span>
          <div className="admin-segmented grid grid-cols-2">
            {(['existing', 'date'] as DestinationMode[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => { setDestinationMode(option); setError(null); setSuccess(null) }}
                className={`rounded-[0.5rem] px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                  destinationMode === option ? 'bg-ws-black text-ws-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-white hover:text-ws-black'
                }`}
              >
                {option === 'existing' ? 'Existing issue' : 'Issue date'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">Item type</span>
          <div className="admin-segmented grid grid-cols-2">
            {(['article', 'event'] as ItemType[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => { setType(option); resetItemFields() }}
                className={`rounded-[0.5rem] px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                  type === option ? 'bg-ws-black text-ws-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-white hover:text-ws-black'
                }`}
              >
                {option === 'article' ? 'Article' : 'Event'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {destinationMode === 'existing' ? (
        <div>
          <label htmlFor="append-any-issue" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
            Existing draft or published issue
          </label>
          <select
            id="append-any-issue"
            value={issueId}
            onChange={event => setIssueId(event.target.value)}
            disabled={loadingIssues || submitting}
            className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          >
            {sortedIssues.length === 0 && <option value="">{loadingIssues ? 'Loading issues...' : 'No issues found'}</option>}
            {sortedIssues.map(issue => (
              <option key={issue.id} value={issue.id}>{issueLabel(issue)}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="append-issue-date" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
            Issue date
          </label>
          <input
            id="append-issue-date"
            type="date"
            value={issueDate}
            onChange={event => setIssueDate(event.target.value)}
            disabled={submitting}
            className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          />
          <p className="mt-1.5 text-[12px] text-ws-black/50">
            If no issue exists for this date, a draft shell is created automatically.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="append-desk-url" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
          URL
        </label>
        <input
          id="append-desk-url"
          type="url"
          value={url}
          onChange={event => { setUrl(event.target.value); setDuplicate(null); setMemoryWarnings([]); setStaleBlocked(false); setSuccess(null) }}
          disabled={submitting}
          placeholder={type === 'article' ? 'https://source-article...' : 'https://event-or-registration-page...'}
          className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[15px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
        />
      </div>

      {type === 'article' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <label htmlFor="append-desk-category" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
              Section
            </label>
            <select
              id="append-desk-category"
              value={category}
              onChange={event => setCategory(event.target.value as Category)}
              disabled={submitting}
              className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
            >
              {CATEGORY_ORDER.map(categoryOption => (
                <option key={categoryOption} value={categoryOption}>
                  {CATEGORY_META[categoryOption].icon} {categoryOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="append-desk-note" className="block text-[11px] font-black uppercase tracking-[0.1em] mb-1.5">
              Note <span className="font-normal normal-case tracking-normal text-ws-black/45">(optional)</span>
            </label>
            <textarea
              id="append-desk-note"
              value={note}
              onChange={event => setNote(event.target.value)}
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
                  onChange={event => setPolishNote(event.target.checked)}
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
                onChange={event => setAllowOlderSource(event.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-4 h-4 accent-ws-black"
              />
              <span>Allow an older publisher date for this target issue.</span>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={extractEvent}
            disabled={extracting || submitting || !url.trim().startsWith('http')}
            className="admin-button-secondary self-start px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {extracting ? 'Extracting...' : 'Extract details'}
          </button>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField label="Title" value={eventTitle} setValue={setEventTitle} disabled={submitting} required />
            <TextField label="When" value={eventWhen} setValue={setEventWhen} disabled={submitting} />
            <TextField label="Where" value={eventWhere} setValue={setEventWhere} disabled={submitting} />
            <label className="flex flex-col gap-1.5 md:row-span-2">
              <span className="text-[11px] font-black uppercase tracking-[0.1em]">Description</span>
              <textarea
                value={eventDescription}
                onChange={event => setEventDescription(event.target.value)}
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
              onClick={() => setDuplicate(null)}
              className="text-[12px] font-medium text-ws-black/60 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {memoryWarnings.length > 0 && (
        <div className="border border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
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
        disabled={submitting || loadingIssues || !canSubmit || !url.trim() || !!duplicate || memoryWarnings.length > 0 || staleBlocked}
        className="admin-button-primary self-start px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Adding...' : `Add ${type} to issue`}
      </button>
    </section>
  )
}

function TextField({
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
        onChange={event => setValue(event.target.value)}
        disabled={disabled}
        className="w-full border border-ws-black/30 bg-ws-page px-3 py-2.5 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
      />
    </label>
  )
}
