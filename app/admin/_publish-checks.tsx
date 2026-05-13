'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminChecksFingerprint, type AdminCheckItem } from '@/lib/admin-readiness'
import { SHORT_ISSUE_CONFIRMATION, splitShortIssueBlockers } from '@/lib/publish-policy'
import type { TodayStatusPayload } from './_today-run-status'

type PublishIssueResponse = {
  ok?: boolean
  issue?: {
    issueNumber?: number | null
  } | null
  error?: string
}

export function PublishChecks({
  password,
  status,
  onPublished,
  forcePublishView = false,
  statusRefreshing = false,
}: {
  password: string
  status: TodayStatusPayload
  onPublished: () => void
  forcePublishView?: boolean
  statusRefreshing?: boolean
}) {
  const [acknowledgedFingerprint, setAcknowledgedFingerprint] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [shortIssueText, setShortIssueText] = useState('')

  const draft = status.draft
  const blockers = status.readiness.blockers
  const warnings = status.readiness.warnings
  const { otherBlockers, hasShortIssueBlocker } = useMemo(
    () => splitShortIssueBlockers(blockers),
    [blockers],
  )
  const hasBlockers = otherBlockers.length > 0
  const hasWarnings = warnings.length > 0
  const requiresWarningAcknowledgement = hasWarnings && !hasBlockers
  const checksFingerprint = useMemo(() => adminChecksFingerprint([...blockers, ...warnings]), [blockers, warnings])
  const warningsAcknowledged = acknowledgedFingerprint === checksFingerprint
  const shortIssueConfirmed = !hasShortIssueBlocker || shortIssueText.trim().toUpperCase() === SHORT_ISSUE_CONFIRMATION

  useEffect(() => {
    setError(null)
    setMessage(null)
    setShortIssueText('')
  }, [checksFingerprint, draft.issueId, draft.published])

  const disabledReason = useMemo(() => {
    if (statusRefreshing) return 'Refreshing publish checks...'
    if (publishing) return 'Publishing issue...'
    if (!draft.exists) return 'No draft is available to publish.'
    if (draft.published) return 'This issue is already published.'
    if (!draft.issueId) return 'Draft is missing its issue ID.'
    if (hasBlockers) return `Resolve ${otherBlockers.length} blocker${otherBlockers.length === 1 ? '' : 's'} before publishing.`
    if (hasShortIssueBlocker && !shortIssueConfirmed) return `Type ${SHORT_ISSUE_CONFIRMATION} to publish a short issue.`
    if (requiresWarningAcknowledgement && !warningsAcknowledged) return 'Acknowledge warnings before publishing.'
    return null
  }, [
    draft.exists,
    draft.issueId,
    draft.published,
    hasBlockers,
    hasShortIssueBlocker,
    otherBlockers.length,
    publishing,
    requiresWarningAcknowledgement,
    shortIssueConfirmed,
    statusRefreshing,
    warningsAcknowledged,
  ])

  const canPublish = Boolean(
    draft.exists &&
      draft.issueId &&
      !draft.published &&
      !hasBlockers &&
      shortIssueConfirmed &&
      (!hasWarnings || warningsAcknowledged) &&
      !statusRefreshing &&
      !publishing,
  )

  async function handlePublish() {
    if (!canPublish || !draft.issueId) return

    setPublishing(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/publish-issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password,
          pageId: draft.issueId,
          checksFingerprint,
          allowShortIssue: hasShortIssueBlocker && shortIssueConfirmed,
          shortIssueConfirmation: hasShortIssueBlocker ? shortIssueText : undefined,
        }),
      })
      const payload = (await res.json()) as PublishIssueResponse

      if (!res.ok || !payload.ok) {
        setError(payload.error ?? 'Issue could not be published.')
        return
      }

      const issueNumber = payload.issue?.issueNumber ?? draft.issueNumber
      setMessage(issueNumber ? `Issue ${issueNumber} published.` : 'Issue published.')
      onPublished()
    } catch {
      setError('Issue could not be published.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className="admin-panel bg-ws-white p-5 sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="admin-eyebrow">Publish readiness</p>
          <h2 className="admin-page-title mt-2">
            Publish readiness
          </h2>
          <p className="admin-copy mt-3 max-w-3xl">
            Blockers must be fixed before publishing. A short issue is blocked by default and requires its own deliberate
            override. Warnings need a human acknowledgement so the issue is not shipped by accident.
          </p>
          {forcePublishView && (
            <p className="mt-2 max-w-3xl text-[14px] font-bold text-ws-black/60">
              This publish step uses the same checks as review, then unlocks the final publish action when the draft is ready.
            </p>
          )}
        </div>

        <div className="min-w-[116px] rounded-[0.6rem] border border-ws-border bg-ws-page px-4 py-3">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">Draft</p>
          <p className="mt-2 text-[22px] font-black leading-none">
            {draft.exists ? `${draft.articleCount} articles` : 'No draft'}
          </p>
          <p className="mt-2 text-[12px] text-ws-black/60">
            {draft.published ? 'Already published' : draft.issueId ? `Issue ID ready` : 'Issue ID missing'}
          </p>
        </div>
      </div>

      {message && (
        <p className="mt-4 border border-green-700 bg-green-50 px-3 py-2 text-[13px] font-bold text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 border border-red-700 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-800">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <CheckList
          title="Blockers"
          emptyText="No blockers found."
          items={blockers}
          tone="blocker"
        />
        <CheckList
          title="Warnings"
          emptyText="No warnings found."
          items={warnings}
          tone="warning"
        />
      </div>

      {requiresWarningAcknowledgement && (
        <label className="mt-5 grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[0.6rem] border border-ws-border bg-ws-page px-4 py-3.5 text-[14px] font-bold leading-[1.45]">
          <input
            type="checkbox"
            checked={warningsAcknowledged}
            onChange={event => setAcknowledgedFingerprint(event.target.checked ? checksFingerprint : null)}
            className="h-5 w-5 shrink-0 accent-[var(--color-ws-accent)]"
          />
          <span>I have reviewed the warnings and still want this issue to be eligible for publishing.</span>
        </label>
      )}

      {hasShortIssueBlocker && otherBlockers.length === 0 && !draft.published && (
        <div className="mt-5 rounded-[0.6rem] border border-red-700 bg-red-50 px-4 py-3.5">
          <p className="text-[14px] font-black text-red-900">Short issue override required</p>
          <p className="mt-1 text-[13px] font-bold leading-[1.45] text-red-800">
            This draft has {draft.articleCount} article{draft.articleCount === 1 ? '' : 's'}. Add more coverage first,
            unless this is intentionally a short issue.
          </p>
          <label className="mt-3 block text-[12px] font-black uppercase tracking-[0.1em] text-red-900" htmlFor="short-issue-confirmation">
            Type {SHORT_ISSUE_CONFIRMATION}
          </label>
          <input
            id="short-issue-confirmation"
            value={shortIssueText}
            onChange={event => setShortIssueText(event.target.value)}
            className="mt-1 w-full rounded-[0.35rem] border border-red-700 bg-ws-white px-3 py-2 text-[14px] font-bold text-ws-black"
            autoComplete="off"
          />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="admin-button-primary px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:bg-ws-black/25"
        >
          {publishing ? 'Publishing...' : draft.published ? 'Already published' : 'Publish issue'}
        </button>
        {disabledReason && <p className="text-[13px] font-bold text-ws-black/60">{disabledReason}</p>}
      </div>
    </section>
  )
}

function CheckList({
  title,
  emptyText,
  items,
  tone,
}: {
  title: string
  emptyText: string
  items: AdminCheckItem[]
  tone: 'blocker' | 'warning'
}) {
  const toneClass = tone === 'blocker' ? 'border-red-700 bg-red-50' : 'border-amber-700 bg-amber-50'

  return (
    <div className="rounded-[0.6rem] border border-ws-border bg-ws-page p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-black uppercase tracking-[0.12em]">{title}</h3>
        <span className="border border-ws-border bg-ws-white px-2 py-1 text-[11px] font-black">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[14px] font-bold text-ws-black/55">{emptyText}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map(item => (
            <li key={item.code} className={`rounded-[0.45rem] border px-3 py-2 ${toneClass}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-[14px] font-black">{item.label}</span>
                <span className="text-[12px] font-black">{item.count}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
