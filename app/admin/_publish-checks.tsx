'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminChecksFingerprint, type AdminCheckItem } from '@/lib/admin-readiness'
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

  const draft = status.draft
  const blockers = status.readiness.blockers
  const warnings = status.readiness.warnings
  const hasBlockers = blockers.length > 0
  const hasWarnings = warnings.length > 0
  const requiresWarningAcknowledgement = hasWarnings && !hasBlockers
  const checksFingerprint = useMemo(() => adminChecksFingerprint([...blockers, ...warnings]), [blockers, warnings])
  const warningsAcknowledged = acknowledgedFingerprint === checksFingerprint

  useEffect(() => {
    setError(null)
    setMessage(null)
  }, [checksFingerprint, draft.issueId, draft.published])

  const disabledReason = useMemo(() => {
    if (statusRefreshing) return 'Refreshing publish checks...'
    if (publishing) return 'Publishing issue...'
    if (!draft.exists) return 'No draft is available to publish.'
    if (draft.published) return 'This issue is already published.'
    if (!draft.issueId) return 'Draft is missing its issue ID.'
    if (hasBlockers) return `Resolve ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} before publishing.`
    if (requiresWarningAcknowledgement && !warningsAcknowledged) return 'Acknowledge warnings before publishing.'
    return null
  }, [
    blockers.length,
    draft.exists,
    draft.issueId,
    draft.published,
    hasBlockers,
    publishing,
    requiresWarningAcknowledgement,
    statusRefreshing,
    warningsAcknowledged,
  ])

  const canPublish = Boolean(
    draft.exists &&
      draft.issueId &&
      !draft.published &&
      !hasBlockers &&
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
        body: JSON.stringify({ password, pageId: draft.issueId, checksFingerprint }),
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
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Publish readiness</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[40px] font-black leading-none tracking-tight">
            Publish readiness
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-[1.55] text-ws-black/65">
            Blockers must be fixed before publishing. Warnings do not stop the run, but they need a human acknowledgement
            so the issue is not shipped by accident.
          </p>
          {forcePublishView && (
            <p className="mt-2 max-w-3xl text-[14px] font-bold text-ws-black/60">
              This publish step uses the same checks as review, then unlocks the final publish action when the draft is ready.
            </p>
          )}
        </div>

        <div className="border-[2px] border-ws-black bg-ws-page px-4 py-3">
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
        <p className="mt-4 border-[2px] border-green-700 bg-green-50 px-3 py-2 text-[13px] font-bold text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 border-[2px] border-red-700 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-800">
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
        <label className="mt-5 flex gap-3 border-[2px] border-ws-black bg-ws-page p-4 text-[14px] font-bold leading-[1.45]">
          <input
            type="checkbox"
            checked={warningsAcknowledged}
            onChange={event => setAcknowledgedFingerprint(event.target.checked ? checksFingerprint : null)}
            className="mt-1 h-5 w-5 accent-[var(--color-ws-accent)]"
          />
          <span>I have reviewed the warnings and still want this issue to be eligible for publishing.</span>
        </label>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="bg-ws-accent px-5 py-3 text-[14px] font-black uppercase tracking-[0.08em] text-white hover:bg-ws-accent-hover disabled:cursor-not-allowed disabled:bg-ws-black/25"
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
    <div className="border-[2px] border-ws-black bg-ws-page p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-black uppercase tracking-[0.12em]">{title}</h3>
        <span className="border border-ws-black bg-ws-white px-2 py-1 text-[11px] font-black">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-[14px] font-bold text-ws-black/55">{emptyText}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map(item => (
            <li key={item.code} className={`border-[2px] px-3 py-2 ${toneClass}`}>
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
