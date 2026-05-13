'use client'

import type { AdminEveningBriefingSummary, AdminReadiness, AdminSourceBreakdownItem } from '@/lib/admin-readiness'

export interface TodayStatusPayload {
  issueDate: string
  automation: { lastRunAt: string | null; sourceCount: number; failureCount: number }
  candidates: {
    totalActive: number
    topPicks: number
    held: number
    rejected: number
    imported: number
    importedWithoutIssueContext: number
    totalVisible?: number
    latestCandidateAt?: string | null
    latestActiveCandidateAt?: string | null
    sourceBreakdown?: AdminSourceBreakdownItem[]
  }
  candidateError?: string | null
  draft: {
    exists: boolean
    published: boolean
    issueId: string | null
    issueNumber: number | null
    issueDate: string
    articleCount: number
    sections: string[]
    missingSummaryCount: number
    missingTitleCount: number
    exactDuplicateUrlCount: number
    similarTopicCount: number
    staleSourceCount: number
    weakTitleCount: number
    missingImageCount: number
    brokenRequiredUrlCount: number
    publishReadinessFailed: boolean
  }
  readiness: AdminReadiness
  eveningBriefing: AdminEveningBriefingSummary
}

export function TodayRunStatus({
  status,
  onPrimaryAction,
}: {
  status: TodayStatusPayload
  onPrimaryAction: () => void
}) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const displayDate = formatter.format(new Date(`${status.issueDate}T12:00:00`))

  return (
    <section className="admin-panel bg-ws-white p-5 sm:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="admin-eyebrow">Tonight&apos;s briefing</p>
          <h1 className="admin-page-title mt-2">
            {displayDate}
          </h1>
          <p className="admin-copy mt-3 max-w-2xl">
            {status.eveningBriefing.headline}. {status.eveningBriefing.nextAction}
          </p>
          {status.candidateError && (
            <p className="mt-3 border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-700">
              Candidate inbox needs attention: {status.candidateError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onPrimaryAction}
          className="admin-button-primary justify-self-start px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] md:justify-self-end"
        >
          {status.readiness.primaryAction.label}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="8 PM briefing"
          value={briefingStateLabel(status.eveningBriefing.state)}
          detail={`Ready target: ${status.eveningBriefing.readyAtLocal}`}
          accent={status.eveningBriefing.state !== 'ready' && status.eveningBriefing.state !== 'published'}
        />
        <StatusCard
          label="Candidates"
          value={`${status.eveningBriefing.usableCandidateCount}/${status.eveningBriefing.candidateTarget}`}
          detail={`${status.candidates.topPicks} strong / ${status.candidates.rejected} rejected / ${status.candidates.imported} imported`}
          accent={status.eveningBriefing.usableCandidateCount < status.eveningBriefing.candidateTarget}
        />
        <StatusCard
          label="Sources"
          value={String(status.eveningBriefing.sourceCount)}
          detail={status.eveningBriefing.latestCandidateLocalDate ? `Latest run: ${status.eveningBriefing.latestCandidateLocalDate}` : 'No run detected'}
          accent={status.eveningBriefing.state === 'stale' || status.eveningBriefing.state === 'source_error'}
        />
        <StatusCard
          label="Draft"
          value={status.draft.exists ? `${status.draft.articleCount} articles` : 'Not started'}
          detail={status.draft.exists ? `${status.draft.sections.length} sections represented` : 'No draft for today yet'}
        />
        <StatusCard
          label="Checks"
          value={`${status.readiness.blockers.length} blockers`}
          detail={`${status.readiness.warnings.length} warnings`}
          accent={status.readiness.blockers.length > 0}
        />
      </div>
    </section>
  )
}

function briefingStateLabel(state: AdminEveningBriefingSummary['state']): string {
  if (state === 'ready') return 'Ready'
  if (state === 'waiting') return 'Waiting'
  if (state === 'stale') return 'Stale'
  if (state === 'low_volume') return 'Low volume'
  if (state === 'published') return 'Live'
  if (state === 'published_needs_repair') return 'Repair'
  return 'Check sources'
}

function StatusCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  accent?: boolean
}) {
  return (
    <div className={`min-h-[88px] rounded-[0.6rem] border px-4 py-3.5 ${accent ? 'border-ws-accent/35 bg-ws-accent-light/35' : 'border-ws-border bg-ws-page/70'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[21px] font-black leading-none">{value}</p>
      <p className="mt-2 text-[12px] leading-snug text-ws-black/60">{detail}</p>
    </div>
  )
}
