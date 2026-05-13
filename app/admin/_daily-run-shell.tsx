'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DailyRunStep } from '@/lib/admin-readiness'
import { CandidateTriage } from './_candidate-triage'
import { DraftSplitEditor } from './_draft-split-editor'
import { PublishChecks } from './_publish-checks'
import { SecondaryAdminTabs } from './_secondary-admin-tabs'
import { TodayRunStatus, type TodayStatusPayload } from './_today-run-status'

type AdminMode = 'guided' | 'full'

const STEPS: Array<{ key: DailyRunStep; label: string }> = [
  { key: 'status', label: 'Status' },
  { key: 'intake', label: 'Intake' },
  { key: 'choose', label: 'Choose' },
  { key: 'edit', label: 'Edit' },
  { key: 'check', label: 'Check' },
  { key: 'publish', label: 'Publish' },
]

export function DailyRunShell({
  password,
  onSignOut,
}: {
  password: string
  onSignOut: () => void
}) {
  const [mode, setMode] = useState<AdminMode>('guided')
  const [activeStep, setActiveStep] = useState<DailyRunStep>('status')
  const [status, setStatus] = useState<TodayStatusPayload | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const statusRequestRef = useRef(0)

  const activeIndex = useMemo(
    () => STEPS.findIndex(step => step.key === activeStep),
    [activeStep],
  )

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const requestId = statusRequestRef.current + 1
    statusRequestRef.current = requestId
    const isActiveRequest = () => statusRequestRef.current === requestId && !signal?.aborted

    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/admin/today-status', {
        headers: { 'x-admin-password': password },
        signal,
      })
      if (res.status === 401) {
        if (isActiveRequest()) {
          setStatusError('Your admin session has expired. Sign out and sign back in.')
        }
        return
      }
      if (!res.ok) {
        if (isActiveRequest()) {
          setStatusError('Today status could not be loaded.')
        }
        return
      }
      const payload = (await res.json()) as TodayStatusPayload
      if (isActiveRequest()) {
        setStatus(payload)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (isActiveRequest()) {
        setStatusError('Today status could not be loaded.')
      }
    } finally {
      if (isActiveRequest()) {
        setStatusLoading(false)
      }
    }
  }, [password])

  useEffect(() => {
    const controller = new AbortController()
    void loadStatus(controller.signal)
    return () => controller.abort()
  }, [loadStatus])

  useEffect(() => {
    function refreshDraftStatus() {
      void loadStatus()
    }

    window.addEventListener('aitoday:refresh-draft', refreshDraftStatus)
    return () => window.removeEventListener('aitoday:refresh-draft', refreshDraftStatus)
  }, [loadStatus])

  function handlePrimaryAction() {
    const action = status?.readiness.primaryAction
    if (!action) return
    if (action.step) {
      setActiveStep(action.step)
      return
    }
    if (action.href) {
      window.location.href = action.href
    }
  }

  function goToRelativeStep(offset: number) {
    const nextStep = STEPS[activeIndex + offset]
    if (nextStep) setActiveStep(nextStep.key)
  }

  return (
    <div className="admin-workspace min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-11">
      <div className="admin-shell flex flex-col gap-4">
      <header className="admin-panel p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="admin-eyebrow">Publisher console</p>
            <h1 className="admin-display-title mt-2">
              Daily Run
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:self-center">
            <div className="admin-segmented grid grid-cols-2 self-start sm:self-auto">
              <ModeButton label="Guided" active={mode === 'guided'} onClick={() => setMode('guided')} />
              <ModeButton label="Full desk" active={mode === 'full'} onClick={() => setMode('full')} />
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="admin-panel overflow-x-auto bg-ws-white p-1.5" aria-label="Daily run steps">
        <div className="admin-step-track grid grid-cols-6 gap-1" style={{ minWidth: '42rem' }}>
          {STEPS.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStep(step.key)}
              className={`whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                activeStep === step.key ? 'bg-ws-accent text-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-page hover:text-ws-black'
              }`}
            >
              <span className={activeStep === step.key ? 'mr-2 text-white/70' : 'mr-2 text-ws-black/35'}>{index + 1}</span>
              {step.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex flex-col gap-4">
        {statusLoading && (
          <PlaceholderSection
            title="Loading today"
            note="Checking the daily run status."
          />
        )}

        {statusError && (
          <section className="admin-panel border-red-200 bg-red-50 p-5 text-red-800">
            <p className="text-[13px] font-black uppercase tracking-[0.15em]">Status unavailable</p>
            <p className="mt-2 text-[15px] font-bold">{statusError}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="mt-4 rounded-[0.55rem] bg-red-700 px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-white"
            >
              Try again
            </button>
          </section>
        )}

        {status && renderActiveStep(
          activeStep,
          status,
          password,
          statusLoading,
          handlePrimaryAction,
          () => void loadStatus(),
          setActiveStep,
        )}

        <div className="admin-panel flex flex-col-reverse gap-3 bg-ws-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => goToRelativeStep(-1)}
            disabled={activeIndex <= 0}
            className="admin-button-ghost text-[14px] font-bold text-ws-black/60 hover:text-ws-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => goToRelativeStep(1)}
            disabled={activeIndex >= STEPS.length - 1}
            className="admin-button-primary px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next step
          </button>
        </div>

        {mode === 'full' && <SecondaryAdminTabs password={password} />}
      </main>
      </div>
    </div>
  )
}

function renderActiveStep(
  activeStep: DailyRunStep,
  status: TodayStatusPayload,
  password: string,
  statusRefreshing: boolean,
  onPrimaryAction: () => void,
  onChanged: () => void,
  onStepChange: (step: DailyRunStep) => void,
) {
  if (activeStep === 'status') {
    return <TodayRunStatus status={status} onPrimaryAction={onPrimaryAction} />
  }

  if (activeStep === 'intake') {
    return (
      <div className="flex flex-col gap-4">
        <TodayRunStatus status={status} onPrimaryAction={onPrimaryAction} />
        <IntakeStatusPanel status={status} onStepChange={onStepChange} />
      </div>
    )
  }

  if (activeStep === 'choose') {
    return <CandidateTriage password={password} onChanged={onChanged} />
  }

  if (activeStep === 'edit') {
    return <DraftSplitEditor password={password} />
  }

  if (activeStep === 'check') {
    return <PublishChecks password={password} status={status} onPublished={onChanged} statusRefreshing={statusRefreshing} />
  }

  if (activeStep === 'publish') {
    return (
      <PublishChecks
        password={password}
        status={status}
        onPublished={onChanged}
        forcePublishView
        statusRefreshing={statusRefreshing}
      />
    )
  }

  return (
    <PlaceholderSection
      title="Publish readiness"
      note="Blocker and warning controls arrive in the publish gate task."
    />
  )
}

function IntakeStatusPanel({
  status,
  onStepChange,
}: {
  status: TodayStatusPayload
  onStepChange: (step: DailyRunStep) => void
}) {
  const hasCandidates = status.candidates.totalActive > 0
  const hasDraft = status.draft.exists
  const hasAutomationSignal = status.automation.sourceCount > 0 || status.automation.failureCount > 0

  return (
    <section className="admin-panel bg-ws-white p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div>
          <p className="admin-eyebrow">Intake</p>
          <h2 className="admin-page-title mt-2">
            Source intake
          </h2>
          <p className="admin-copy mt-3 max-w-3xl">
            Check whether the source run produced usable material, then move directly into candidate review or draft editing.
            This step is read-only so the daily path stays safe before any publish action.
          </p>
        </div>

        <div className="admin-subpanel p-4">
          <p className="admin-field-label">Next move</p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onStepChange(hasCandidates ? 'choose' : 'edit')}
              className="admin-button-primary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
            >
              {hasCandidates ? 'Review candidates' : 'Open draft editor'}
            </button>
            {hasDraft && (
              <button
                type="button"
                onClick={() => onStepChange('check')}
                className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
              >
                Check readiness
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <IntakeMetric
          label="Automation record"
          value={status.automation.lastRunAt ? 'Run detected' : hasAutomationSignal ? 'Needs review' : 'No run recorded'}
          detail={`${status.automation.sourceCount} sources / ${status.automation.failureCount} failures`}
          tone={status.automation.failureCount > 0 ? 'warning' : 'neutral'}
        />
        <IntakeMetric
          label="Candidate queue"
          value={`${status.candidates.totalActive} active`}
          detail={`${status.candidates.topPicks} top picks / ${status.candidates.held} held / ${status.candidates.imported} imported / ${status.candidates.importedWithoutIssueContext} untraced`}
          tone={hasCandidates ? 'good' : 'neutral'}
        />
        <IntakeMetric
          label="Draft state"
          value={hasDraft ? `${status.draft.articleCount} articles` : 'No draft'}
          detail={hasDraft ? `${status.draft.sections.length} sections represented` : 'Keep a candidate or add an item to start'}
          tone={hasDraft ? 'good' : 'neutral'}
        />
      </div>

      {status.candidateError && (
        <div className="admin-danger-notice mt-5 rounded-[0.6rem] px-4 py-3">
          <p className="admin-field-label text-red-800">Candidate inbox</p>
          <p className="mt-1 text-[14px] font-bold leading-snug">{status.candidateError}</p>
        </div>
      )}
    </section>
  )
}

function IntakeMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warning' | 'neutral'
}) {
  const toneClass = tone === 'good'
    ? 'border-green-800/20 bg-green-50/80'
    : tone === 'warning'
      ? 'border-amber-700/35 bg-amber-50'
      : 'border-ws-border bg-ws-page/70'

  return (
    <div className={`min-h-[104px] rounded-[0.6rem] border px-4 py-3.5 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-black/55">{label}</p>
      <p className="mt-2 text-[20px] font-black leading-tight text-ws-black">{value}</p>
      <p className="mt-2 text-[12px] leading-snug text-ws-black/60">{detail}</p>
    </div>
  )
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[0.5rem] px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
        active ? 'bg-ws-black text-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-page hover:text-ws-black'
      }`}
    >
      {label}
    </button>
  )
}

function PlaceholderSection({
  title,
  note,
}: {
  title: string
  note: string
}) {
  return (
    <section className="admin-panel border-dashed bg-ws-white p-6">
      <p className="admin-eyebrow">Coming next</p>
      <h2 className="admin-page-title mt-2">
        {title}
      </h2>
      <p className="admin-copy mt-3 max-w-2xl">{note}</p>
    </section>
  )
}
