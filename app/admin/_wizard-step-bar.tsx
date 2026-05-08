'use client'

import type { StepKey } from './_constants'

export function WizardStepBar({
  steps,
  labels,
  activeStep,
  completedSteps,
  flashingStep,
  onStepClick,
}: {
  steps: readonly StepKey[]
  labels: Record<StepKey, string>
  activeStep: StepKey
  completedSteps: Set<StepKey>
  flashingStep: StepKey | null
  onStepClick: (step: StepKey) => void
}) {
  return (
    <div
      role="navigation"
      aria-label="Wizard steps"
      className="bg-ws-black px-3 py-2.5 flex items-center gap-2 overflow-x-auto overscroll-x-contain md:flex-wrap md:px-4 md:py-3"
    >
      {steps.map((step, i) => {
        const isDone    = completedSteps.has(step)
        const isActive  = step === activeStep
        const isFlashing = step === flashingStep
        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepClick(step)}
            aria-current={isActive ? 'step' : undefined}
            className={[
              'flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] border-[2px] transition-colors duration-75',
              isFlashing
                ? 'border-ws-accent bg-ws-accent text-ws-black animate-pulse'
                : isActive
                  ? 'border-ws-accent bg-ws-accent text-ws-black'
                  : isDone
                    ? 'border-white/40 bg-white/10 text-white/70 hover:bg-white/20'
                    : 'border-white/20 bg-transparent text-white/40 hover:bg-white/10 hover:text-white/60',
            ].join(' ')}
          >
            {isDone && !isActive && <span aria-hidden="true">✓</span>}
            <span className="md:hidden" aria-hidden="true">{i + 1}</span>
            <span className="hidden md:inline">{i + 1}. {labels[step]}</span>
          </button>
        )
      })}
    </div>
  )
}
