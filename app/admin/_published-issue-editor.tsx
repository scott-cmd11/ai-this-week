'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppendToPublishedIssue, type PublishedIssue } from './_append-to-published-issue'

interface EditablePublishedItem {
  id: string
  section: string
  title: string
  titleBlockId: string
  blockIds: string[]
  summary: string
  summaryBlockId: string | null
  sourceUrl: string | null
  publishedDate: string | null
}

export function PublishedIssueEditor({ password }: { password: string }) {
  const [issues, setIssues] = useState<PublishedIssue[]>([])
  const [issueId, setIssueId] = useState('')
  const [items, setItems] = useState<EditablePublishedItem[]>([])
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedIssue = issues.find(issue => issue.id === issueId) ?? null
  const publicPath = selectedIssue ? `/issues/${selectedIssue.issueDate}` : null

  useEffect(() => {
    let cancelled = false

    async function loadIssues() {
      setLoadingIssues(true)
      setError(null)
      try {
        const res = await fetch('/api/published-issues', {
          headers: { 'x-admin-password': password },
        })
        const payload = await res.json()
        if (!res.ok) {
          if (!cancelled) setError(payload.error ?? `Could not load published issues (${res.status}).`)
          return
        }
        const nextIssues = (payload.issues ?? []) as PublishedIssue[]
        if (cancelled) return
        setIssues(nextIssues)
        setIssueId(current => current || nextIssues[0]?.id || '')
      } catch {
        if (!cancelled) setError('Could not load published issues.')
      } finally {
        if (!cancelled) setLoadingIssues(false)
      }
    }

    loadIssues()
    return () => { cancelled = true }
  }, [password])

  async function refreshItems(targetIssueId = issueId) {
    if (!targetIssueId) {
      setItems([])
      return
    }

    setLoadingItems(true)
    setError(null)
    try {
      const res = await fetch(`/api/published-issue-items?issueId=${encodeURIComponent(targetIssueId)}`, {
        headers: { 'x-admin-password': password },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not load issue items (${res.status}).`)
        setItems([])
        return
      }
      setItems((payload.items ?? []) as EditablePublishedItem[])
    } catch {
      setError('Could not load issue items.')
      setItems([])
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    refreshItems(issueId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId, password])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, EditablePublishedItem[]>()
    for (const item of items) {
      if (!groups.has(item.section)) groups.set(item.section, [])
      groups.get(item.section)!.push(item)
    }
    return [...groups.entries()]
  }, [items])

  return (
    <section className="admin-subpanel flex flex-col gap-5 bg-ws-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] md:items-start">
        <div>
          <p className="admin-eyebrow">Edit a published issue</p>
          <h3 className="admin-page-title mt-2">
            Live issue desk
          </h3>
          <p className="admin-copy mt-3 max-w-2xl">
            Use this after an issue is public. Edit existing story titles or summaries here, or add a late article or event without going back through the daily draft workflow.
          </p>
        </div>

        <div className="admin-subpanel bg-ws-page/70 p-3.5">
          <p className="admin-field-label mb-2">Live edit rules</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12px] leading-snug text-ws-black/65">
            <li>Use draft review for today&apos;s unpublished issue.</li>
            <li>Use this desk for corrections after publication.</li>
            <li>Use the remove action here for cleanup.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label htmlFor="live-issue-target" className="admin-field-label">
            Published issue
          </label>
          <select
            id="live-issue-target"
            value={issueId}
            onChange={event => setIssueId(event.target.value)}
            disabled={loadingIssues}
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

        <div className="flex flex-wrap gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => refreshItems()}
            disabled={loadingItems || !issueId}
            className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingItems ? 'Refreshing...' : 'Refresh'}
          </button>
          {publicPath && (
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              View public issue
            </a>
          )}
        </div>
      </div>

      {error && <p className="admin-notice admin-danger-notice px-3 py-2">{error}</p>}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-ws-border pb-2">
          <div className="min-w-0">
            <p className="admin-eyebrow">Existing live items</p>
            <p className="mt-1 text-[12px] text-ws-black/50">
              Edit a title or summary, then save. Public pages refresh after each save.
            </p>
          </div>
          <span className="whitespace-nowrap text-[12px] font-black uppercase tracking-[0.08em] text-ws-black/45">
            {items.length} items
          </span>
        </div>

        {loadingItems && <p className="text-[14px] text-ws-black/60">Loading live issue items...</p>}

        {!loadingItems && groupedItems.length === 0 && (
          <p className="admin-notice px-3 py-3">
            Choose a published issue to see editable items.
          </p>
        )}

        {!loadingItems && groupedItems.map(([section, sectionItems]) => (
          <section key={section} className="admin-subpanel overflow-hidden bg-ws-white">
            <div className="flex items-baseline justify-between gap-3 border-b border-ws-border bg-ws-page/70 px-3 py-2">
              <p className="text-[12px] font-black uppercase tracking-[0.1em]">{section}</p>
              <p className="text-[11px] text-ws-black/45">{sectionItems.length} item{sectionItems.length === 1 ? '' : 's'}</p>
            </div>
            <div className="divide-y divide-ws-black/10">
              {sectionItems.map(item => (
                <EditableItemRow
                  key={item.id}
                  item={item}
                  issueId={issueId}
                  password={password}
                  onSaved={() => refreshItems(issueId)}
                  onRemoved={() => refreshItems(issueId)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-ws-border pt-5">
        <AppendToPublishedIssue
          password={password}
          defaultOpen
          lockedOpen
          issues={issues}
          issueId={issueId}
          onIssueIdChange={setIssueId}
          hideIssuePicker
          onAppended={() => refreshItems(issueId)}
        />
      </div>
    </section>
  )
}

function EditableItemRow({
  item,
  issueId,
  password,
  onSaved,
  onRemoved,
}: {
  item: EditablePublishedItem
  issueId: string
  password: string
  onSaved: () => void
  onRemoved: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [summary, setSummary] = useState(item.summary)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(item.title)
    setSummary(item.summary)
    setMessage(null)
    setError(null)
    setConfirmRemove(false)
  }, [item.id, item.title, item.summary])

  const changed = title.trim() !== item.title.trim() || summary.trim() !== item.summary.trim()
  const sourceLabel = item.sourceUrl ? hostnameOf(item.sourceUrl) : 'No source URL'

  async function save() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/update-published-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          issueId,
          itemId: item.id,
          title,
          summary,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not save item (${res.status}).`)
        return
      }
      setMessage('Saved and refreshed.')
      onSaved()
    } catch {
      setError('Could not save item.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setRemoving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/remove-published-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          issueId,
          itemId: item.id,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Could not remove item (${res.status}).`)
        return
      }
      onRemoved()
    } catch {
      setError('Could not remove item.')
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  return (
    <details className="group bg-ws-white open:bg-ws-page/35">
      <summary className="cursor-pointer list-none px-4 py-3 hover:bg-ws-page">
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-snug text-ws-black">{item.title}</p>
            <p className="mt-1 text-[12px] text-ws-black/45">
              {sourceLabel}{item.publishedDate ? ` / Published ${item.publishedDate}` : ''}
            </p>
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.08em] text-ws-accent group-open:text-ws-black">
            Edit
          </span>
        </div>
      </summary>

      <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="admin-field-label">Title</span>
          <textarea
            value={title}
            onChange={event => setTitle(event.target.value)}
            rows={2}
            disabled={saving || removing}
            className="admin-input px-3 py-2.5 font-semibold leading-[1.35]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="admin-field-label">
            Summary{item.summaryBlockId ? '' : ' (not editable)'}
          </span>
          <textarea
            value={summary}
            onChange={event => setSummary(event.target.value)}
            rows={4}
            disabled={saving || removing || !item.summaryBlockId}
            className="admin-input px-3 py-2.5 leading-[1.45]"
          />
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={save}
            disabled={saving || removing || !changed || !title.trim()}
            className="admin-button-primary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save edit'}
          </button>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-ws-black/55 underline hover:text-ws-accent hover:no-underline"
            >
              Open source
            </a>
          )}
          {message && <span className="text-[12px] font-bold text-ws-black/70">{message}</span>}
          {error && <span className="text-[12px] font-bold text-red-700">{error}</span>}
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={saving || removing}
            className="ml-auto rounded-[0.55rem] px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-red-700 underline decoration-red-700/30 underline-offset-2 hover:bg-red-50 hover:decoration-red-700 disabled:opacity-40"
          >
            Remove
          </button>
        </div>

        {confirmRemove && (
          <div className="admin-notice admin-danger-notice px-3 py-3 flex flex-col gap-3">
            <p className="text-[13px] font-bold leading-snug text-red-800">
              Remove this item from the published issue? This deletes the story blocks from the issue store and refreshes the public page.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={remove}
                disabled={removing}
                className="rounded-[0.55rem] bg-red-700 px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-white hover:bg-red-800 disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Remove from issue'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                disabled={removing}
                className="rounded-[0.55rem] px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-ws-black/60 underline hover:bg-ws-white hover:text-ws-black disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
