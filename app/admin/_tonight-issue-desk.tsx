'use client'

import type { AdminEveningBriefingSummary } from '@/lib/admin-readiness'
import { CandidateTriage } from './_candidate-triage'
import { DraftSplitEditor } from './_draft-split-editor'
import { PublishChecks } from './_publish-checks'
import { TodayRunStatus, type TodayStatusPayload } from './_today-run-status'

export function TonightIssueDesk({
  password,
  status,
  statusRefreshing,
  onRefresh,
  onOpenIssueDesk,
  onOpenTools,
}: {
  password: string
  status: TodayStatusPayload
  statusRefreshing: boolean
  onRefresh: () => void
  onOpenIssueDesk: () => void
  onOpenTools: () => void
}) {
  function handlePrimaryAction() {
    const action = status.readiness.primaryAction
    if (action.href) {
      window.location.href = action.href
      return
    }
    scrollToDeskSection(stepTarget(action.step))
  }

  return (
    <div className="flex flex-col gap-4">
      <TodayRunStatus status={status} onPrimaryAction={handlePrimaryAction} />
      <EveningBriefingPanel
        briefing={status.eveningBriefing}
        articleCount={status.draft.articleCount}
        onRefresh={onRefresh}
        onReviewCandidates={() => scrollToDeskSection('candidate-review')}
        onEditDraft={() => scrollToDeskSection('draft-editor')}
        onPublishChecks={() => scrollToDeskSection('publish-checks')}
        onOpenIssueDesk={onOpenIssueDesk}
        onOpenTools={onOpenTools}
      />

      <section id="candidate-review" aria-label="Candidate review">
        <CandidateTriage password={password} onChanged={onRefresh} />
      </section>

      <section id="draft-editor" aria-label="Draft editor">
        <DraftSplitEditor password={password} />
      </section>

      <section id="publish-checks" aria-label="Publish checks">
        <PublishChecks
          password={password}
          status={status}
          onPublished={onRefresh}
          statusRefreshing={statusRefreshing}
        />
      </section>
    </div>
  )
}

function stepTarget(step: TodayStatusPayload['readiness']['primaryAction']['step']): string {
  if (step === 'choose') return 'candidate-review'
  if (step === 'edit') return 'draft-editor'
  if (step === 'check' || step === 'publish') return 'publish-checks'
  return 'candidate-review'
}

function scrollToDeskSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
}

function EveningBriefingPanel({
  briefing,
  articleCount,
  onRefresh,
  onReviewCandidates,
  onEditDraft,
  onPublishChecks,
  onOpenIssueDesk,
  onOpenTools,
}: {
  briefing: AdminEveningBriefingSummary
  articleCount: number
  onRefresh: () => void
  onReviewCandidates: () => void
  onEditDraft: () => void
  onPublishChecks: () => void
  onOpenIssueDesk: () => void
  onOpenTools: () => void
}) {
  const stateClass = briefing.state === 'ready' || briefing.state === 'published'
    ? 'border-green-800/20 bg-green-50/75'
    : briefing.state === 'source_error' || briefing.state === 'published_needs_repair'
      ? 'border-ws-accent/35 bg-ws-accent-light/35'
      : 'border-amber-700/35 bg-amber-50/80'

  return (
    <section className={`admin-panel border p-5 sm:p-6 ${stateClass}`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div>
          <p className="admin-eyebrow">Evening briefing</p>
          <h2 className="admin-page-title mt-2">
            {briefing.headline}
          </h2>
          <p className="admin-copy mt-3 max-w-3xl">
            {briefing.explanation}
          </p>
          <p className="mt-3 text-[14px] font-bold leading-snug text-ws-black/75">
            {briefing.nextAction}
          </p>
        </div>

        <div className="admin-subpanel bg-ws-white/80 p-4">
          <p className="admin-field-label">Next move</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onReviewCandidates}
              className="admin-button-primary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              Review candidates
            </button>
            <button
              type="button"
              onClick={onEditDraft}
              className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              Edit draft
            </button>
            <button
              type="button"
              onClick={briefing.state === 'published' || briefing.state === 'published_needs_repair' ? onOpenIssueDesk : onPublishChecks}
              className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              {briefing.state === 'published' || briefing.state === 'published_needs_repair' ? 'Open Issue Desk' : 'Publish checklist'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BriefingMetric
          label="Candidate pool"
          value={`${briefing.usableCandidateCount}/${briefing.candidateTarget}`}
          detail={`${briefing.totalCandidatesSeen} seen across active, imported, and rejected states`}
          accent={briefing.usableCandidateCount < briefing.candidateTarget}
        />
        <BriefingMetric
          label="Strong candidates"
          value={`${briefing.strongCandidateCount}/${briefing.strongCandidateTarget}`}
          detail={`${briefing.importedCandidateCount} imported / ${briefing.rejectedCandidateCount} rejected`}
          accent={briefing.strongCandidateCount < briefing.strongCandidateTarget}
        />
        <BriefingMetric
          label="Issue draft"
          value={`${articleCount}/${briefing.publishArticleTarget}`}
          detail={`Normal publish blocks below ${briefing.minimumArticleCount} articles`}
          accent={articleCount > 0 && articleCount < briefing.minimumArticleCount}
        />
        <BriefingMetric
          label="Source health"
          value={`${briefing.sourceCount} source${briefing.sourceCount === 1 ? '' : 's'}`}
          detail={briefing.latestCandidateAt ? `Latest: ${formatCandidateTime(briefing.latestCandidateAt)}` : 'No run detected'}
          accent={briefing.state === 'stale' || briefing.state === 'source_error'}
        />
      </div>

      {briefing.lowVolumeReasons.length > 0 && (
        <div className="admin-subpanel mt-5 bg-ws-white/80 p-4">
          <p className="admin-field-label">What needs attention</p>
          <ul className="mt-3 grid gap-2">
            {briefing.lowVolumeReasons.map(reason => (
              <li key={reason} className="border-t border-ws-border pt-2 text-[13px] font-bold leading-snug text-ws-black/70 first:border-t-0 first:pt-0">
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              Refresh status
            </button>
            <button
              type="button"
              onClick={onOpenTools}
              className="admin-button-secondary px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              Source tools
            </button>
          </div>
        </div>
      )}

      {briefing.sourceBreakdown.length > 0 && (
        <div className="mt-5">
          <p className="admin-field-label">Source mix</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {briefing.sourceBreakdown.slice(0, 6).map(source => (
              <div key={source.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-ws-border pt-2 text-[13px] first:border-t-0 first:pt-0 md:first:border-t md:first:pt-2">
                <span className="truncate font-bold text-ws-black">{source.name}</span>
                <span className="font-black text-ws-black/65">{source.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function BriefingMetric({
  label,
  value,
  detail,
  accent,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) {
  return (
    <div className={`min-h-[104px] rounded-[0.6rem] border px-4 py-3.5 ${accent ? 'border-ws-accent/35 bg-ws-white/85' : 'border-ws-border bg-ws-white/70'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[22px] font-black leading-none text-ws-black">{value}</p>
      <p className="mt-2 text-[12px] leading-snug text-ws-black/60">{detail}</p>
    </div>
  )
}

function formatCandidateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Winnipeg',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}
