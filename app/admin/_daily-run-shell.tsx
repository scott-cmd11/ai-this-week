'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DailyRunStep } from '@/lib/admin-readiness'
import { CandidateTriage } from './_candidate-triage'
import { DraftSplitEditor } from './_draft-split-editor'
import { PublishChecks } from './_publish-checks'
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

  const activeIndex = useMemo(
    () => STEPS.findIndex(step => step.key === activeStep),
    [activeStep],
  )

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/admin/today-status', {
        headers: { 'x-admin-password': password },
        signal,
      })
      if (res.status === 401) {
        setStatusError('Your admin session has expired. Sign out and sign back in.')
        return
      }
      if (!res.ok) {
        setStatusError('Today status could not be loaded.')
        return
      }
      const payload = (await res.json()) as TodayStatusPayload
      setStatus(payload)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setStatusError('Today status could not be loaded.')
    } finally {
      setStatusLoading(false)
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
    <div className="admin-workspace flex min-h-screen flex-col gap-5 px-0 py-0 md:px-6 md:py-4">
      <header className="border-[3px] border-ws-black bg-ws-white p-4 shadow-[4px_4px_0_0_var(--color-ws-black)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-ws-black/60">Publisher console</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-[44px] font-black leading-[0.92] tracking-tight sm:text-[64px]">
              Daily Run
            </h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 border-[2px] border-ws-black">
              <ModeButton label="Guided" active={mode === 'guided'} onClick={() => setMode('guided')} />
              <ModeButton label="Full desk" active={mode === 'full'} onClick={() => setMode('full')} />
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="border-[2px] border-ws-black px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] hover:border-ws-accent hover:bg-ws-page"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <nav className="overflow-x-auto border-y-[2px] border-ws-black bg-ws-page" aria-label="Daily run steps">
        <div className="flex min-w-max">
          {STEPS.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStep(step.key)}
              className={`border-r-[2px] border-ws-black px-4 py-3 text-left text-[12px] font-black uppercase tracking-[0.08em] ${
                activeStep === step.key ? 'bg-ws-accent text-white' : 'bg-ws-white text-ws-black hover:bg-ws-accent-light/40'
              }`}
            >
              <span className="mr-2 text-ws-black/45">{index + 1}</span>
              {step.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex flex-col gap-5">
        {statusLoading && (
          <PlaceholderSection
            title="Loading today"
            note="Checking the daily run status."
          />
        )}

        {statusError && (
          <section className="border-[3px] border-red-700 bg-red-50 p-5 text-red-800 shadow-[4px_4px_0_0_#991b1b]">
            <p className="text-[13px] font-black uppercase tracking-[0.15em]">Status unavailable</p>
            <p className="mt-2 text-[15px] font-bold">{statusError}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="mt-4 bg-red-700 px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-white"
            >
              Try again
            </button>
          </section>
        )}

        {status && renderActiveStep(activeStep, status, password, statusLoading, handlePrimaryAction, () => void loadStatus())}

        <div className="flex flex-col-reverse gap-3 border-t border-ws-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => goToRelativeStep(-1)}
            disabled={activeIndex <= 0}
            className="text-[14px] font-bold text-ws-black/60 hover:text-ws-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => goToRelativeStep(1)}
            disabled={activeIndex >= STEPS.length - 1}
            className="bg-ws-accent px-5 py-3 text-[14px] font-black uppercase tracking-[0.08em] text-white hover:bg-ws-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next step
          </button>
        </div>

        {mode === 'full' && (
          <PlaceholderSection
            title="Secondary areas"
            note="Issue Desk, Future Queue, Health, and Settings are organized in a later task."
          />
        )}
      </main>
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
      className={`px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
        active ? 'bg-ws-black text-white' : 'bg-ws-white text-ws-black hover:bg-ws-page'
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
    <section className="border-[3px] border-dashed border-ws-black bg-ws-white p-5">
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-ws-black/55">Coming next</p>
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-[36px] font-black leading-none tracking-tight">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ws-black/65">{note}</p>
    </section>
  )
}
