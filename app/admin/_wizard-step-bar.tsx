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
      className="bg-[#1C1917] px-4 sm:px-6 py-4 flex items-center justify-center"
    >
      <div className="flex items-center w-full max-w-xl">
        {steps.map((step, i) => {
          const isDone     = completedSteps.has(step)
          const isActive   = step === activeStep
          const isFlashing = step === flashingStep
          const isLast     = i === steps.length - 1

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onStepClick(step)}
                  aria-current={isActive ? 'step' : undefined}
                  className="flex flex-col items-center gap-1 group"
                >
                  {/* Circle */}
                  <div className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black transition-all duration-150',
                    isFlashing
                      ? 'bg-ws-accent text-white animate-pulse'
                      : isActive
                        ? 'bg-ws-accent text-white'
                        : isDone
                          ? 'bg-white/20 text-white'
                          : 'border-2 border-white/20 text-white/30',
                  ].join(' ')}>
                    {isDone && !isActive ? '✓' : i + 1}
                  </div>
                  {/* Label */}
                  <span className={[
                    'hidden sm:block text-[11px] font-medium mt-0.5 whitespace-nowrap transition-colors',
                    isActive ? 'text-white' : isDone ? 'text-white/60' : 'text-white/30',
                  ].join(' ')}>
                    {labels[step]}
                  </span>
                </button>
              </div>
              {/* Connecting line */}
              {!isLast && (
                <div className={[
                  'h-px flex-1 mx-2 mb-5 sm:mb-5',
                  isDone ? 'bg-ws-accent/40' : 'bg-white/15',
                ].join(' ')} aria-hidden="true" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
