'use client'

import type { StepKey } from './_constants'

export function StepDoneButton({
  currentKey,
  nextKey,
  nextLabel,
  nextRef,
  completedSteps,
  onDone,
}: {
  currentKey: StepKey
  nextKey: StepKey | null
  nextLabel: string | null
  nextRef: { current: HTMLDivElement | null } | null
  completedSteps: Set<StepKey>
  onDone: (key: StepKey, nextKey: StepKey | null, nextRef: { current: HTMLDivElement | null } | null) => void
}) {
  if (completedSteps.has(currentKey)) {
    return (
      <div className="flex justify-end pt-2">
        <span className="text-[12px] font-black text-ws-accent uppercase tracking-wide">✓ Done</span>
      </div>
    )
  }

  return (
    <div className="flex justify-end pt-4">
      <button
        type="button"
        onClick={() => onDone(currentKey, nextKey, nextRef)}
        className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[12px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent"
      >
        {nextLabel ? `Done → ${nextLabel}` : 'All done ✓'}
      </button>
    </div>
  )
}
