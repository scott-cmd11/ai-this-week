'use client'

import type { AdminReadiness } from '@/lib/admin-readiness'

export interface TodayStatusPayload {
  issueDate: string
  automation: { lastRunAt: string | null; sourceCount: number; failureCount: number }
  candidates: { totalActive: number; topPicks: number; held: number; rejected: number; imported: number }
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
    <section className="admin-panel bg-ws-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today&apos;s run status</p>
          <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-[36px] font-black leading-[0.98] tracking-tight sm:text-[44px]">
            {displayDate}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.5] text-ws-black/65">
            {status.readiness.nextBestAction}
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="Automations"
          value={status.automation.lastRunAt ? 'Ran' : 'Needs check'}
          detail={`${status.automation.sourceCount} sources / ${status.automation.failureCount} failures`}
        />
        <StatusCard
          label="Candidates"
          value={String(status.candidates.totalActive)}
          detail={`${status.candidates.topPicks} top picks / ${status.candidates.held} held`}
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
    <div className={`rounded-[0.65rem] border px-4 py-3 ${accent ? 'border-ws-accent/35 bg-ws-accent-light/35' : 'border-ws-border bg-ws-page/70'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[22px] font-black leading-none">{value}</p>
      <p className="mt-2 text-[12px] leading-snug text-ws-black/60">{detail}</p>
    </div>
  )
}
