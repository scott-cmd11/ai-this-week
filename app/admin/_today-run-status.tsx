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
    <section className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today&apos;s run status</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[44px] font-black leading-[0.95] tracking-tight">
            {displayDate}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ws-black/65">
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
          className="bg-ws-accent px-5 py-3 text-[14px] font-black uppercase tracking-[0.08em] text-white hover:bg-ws-accent-hover"
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
    <div className={`border-[2px] px-4 py-3 ${accent ? 'border-ws-accent bg-ws-accent-light/30' : 'border-ws-black bg-ws-page'}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[24px] font-black leading-none">{value}</p>
      <p className="mt-2 text-[12px] text-ws-black/60">{detail}</p>
    </div>
  )
}
