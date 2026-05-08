'use client'

import type { StepKey } from './_constants'

export function StepDoneButton({
  currentKey,
  nextKey,
  nextLabel,
  nextRef,
  completedSteps,
  onDone,
  disabled = false,
  disabledLabel,
  title,
}: {
  currentKey: StepKey
  nextKey: StepKey | null
  nextLabel: string | null
  nextRef: { current: HTMLDivElement | null } | null
  completedSteps: Set<StepKey>
  onDone: (key: StepKey, nextKey: StepKey | null, nextRef: { current: HTMLDivElement | null } | null) => void
  disabled?: boolean
  disabledLabel?: string
  title?: string
}) {
  if (completedSteps.has(currentKey)) {
    return (
      <div className="flex justify-end pt-2">
        <span className="text-[12px] font-black text-ws-accent uppercase tracking-wide">Done</span>
      </div>
    )
  }

  return (
    <div className="flex justify-end pt-4">
      <button
        type="button"
        onClick={() => onDone(currentKey, nextKey, nextRef)}
        disabled={disabled}
        title={title}
        className="w-full border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[12px] px-4 py-3 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] disabled:hover:bg-ws-black sm:w-auto sm:py-2"
      >
        {disabled ? (disabledLabel ?? 'Action required') : nextLabel ? `Done -> ${nextLabel}` : 'All done'}
      </button>
    </div>
  )
}
