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
    <div className="admin-workspace min-h-screen px-3 py-4 sm:px-5 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4">
      <header className="admin-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-ws-black/60">Publisher console</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-[40px] font-black leading-[0.95] tracking-tight sm:text-[56px]">
              Daily Run
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="admin-segmented grid grid-cols-2">
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

      <nav className="overflow-x-auto rounded-[0.75rem] border border-ws-border bg-ws-white p-1.5 shadow-sm" aria-label="Daily run steps">
        <div className="flex min-w-max gap-1">
          {STEPS.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStep(step.key)}
              className={`rounded-[0.55rem] px-3 py-2.5 text-left text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
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

        {status && renderActiveStep(activeStep, status, password, statusLoading, handlePrimaryAction, () => void loadStatus())}

        <div className="flex flex-col-reverse gap-3 rounded-[0.75rem] border border-ws-border bg-ws-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
            className="admin-button-primary px-5 py-3 text-[14px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
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
) {
  if (activeStep === 'status') {
    return <TodayRunStatus status={status} onPrimaryAction={onPrimaryAction} />
  }

  if (activeStep === 'intake') {
    return (
      <div className="flex flex-col gap-4">
        <TodayRunStatus status={status} onPrimaryAction={onPrimaryAction} />
        <PlaceholderSection
          title="Automation intake"
          note="Daily source review and import controls arrive in a later task."
        />
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
    <section className="admin-panel border-dashed bg-ws-white p-5">
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ws-black/55">Coming next</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[32px] font-black leading-none tracking-tight">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ws-black/65">{note}</p>
    </section>
  )
}
