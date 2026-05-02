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
      className="bg-ws-black px-4 py-3 flex items-center gap-1.5 flex-wrap"
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
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] border-[2px] transition-colors duration-75',
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
            <span className="sm:hidden" aria-hidden="true">{i + 1}</span>
            <span className="hidden sm:inline">{i + 1}. {labels[step]}</span>
          </button>
        )
      })}
    </div>
  )
}
