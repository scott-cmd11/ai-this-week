'use client'

import type { StepKey } from './_constants'

export function WorkflowSidebar({
  steps,
  completedSteps,
  activeStep,
  onStepClick,
}: {
  steps: { key: StepKey; label: string; ref: { current: HTMLDivElement | null } }[]
  completedSteps: Set<StepKey>
  activeStep: StepKey
  onStepClick: (key: StepKey, ref: { current: HTMLDivElement | null }) => void
}) {
  return (
    <aside aria-label="Today's workflow" className="hidden md:flex w-44 shrink-0 self-start sticky top-0 bg-ws-black text-ws-white min-h-screen flex-col pt-10 pb-8 px-3">
      <p className="text-[9px] font-black tracking-[.12em] uppercase text-white/40 mb-3 px-2">
        Today&apos;s workflow
      </p>

      <nav aria-label="Workflow steps" className="flex flex-col gap-0.5">
        {steps.map(({ key, label, ref }, i) => {
          const done   = completedSteps.has(key)
          const active = activeStep === key && !done

          return (
            <button
              key={key}
              type="button"
              onClick={() => onStepClick(key, ref)}
              className={[
                'flex items-center gap-2.5 px-2 py-1.5 text-left w-full rounded-[2px] transition-colors',
                done   ? 'opacity-70 hover:opacity-90'
                : active ? 'bg-white/10 border-l-2 border-ws-accent'
                : 'opacity-40 hover:opacity-60',
              ].join(' ')}
            >
              {/* Badge */}
              <span className={[
                'w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                done   ? 'bg-ws-accent text-ws-black'
                : active ? 'bg-ws-accent text-ws-black'
                : 'border border-white/30 text-white/50',
              ].join(' ')}>
                {done ? '✓' : i + 1}
              </span>

              <span className={[
                'text-[11px] leading-tight',
                active ? 'font-black text-white' : 'font-medium text-white/80',
              ].join(' ')}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Divider + other links */}
      <div className="border-t border-white/10 mt-4 pt-4 px-2 flex flex-col gap-1">
        <p className="text-[9px] font-black tracking-[.12em] uppercase text-white/30 mb-1">Other</p>
        <button
          type="button"
          onClick={() => document.getElementById('site-stats')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="text-[11px] text-white/40 hover:text-white/70 text-left transition-colors"
        >
          Site stats
        </button>
        <button
          type="button"
          onClick={() => document.getElementById('capture-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="text-[11px] text-white/40 hover:text-white/70 text-left transition-colors"
        >
          Settings
        </button>
      </div>
    </aside>
  )
}
