'use client'

import { useReadingProgress } from './useReadingProgress'

export function ReadingProgress() {
  const progress = useReadingProgress()

  const rounded = Math.round(progress)

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ width: `${progress}%` }}
      className="pointer-events-none fixed left-0 top-0 z-50 h-[4px] bg-ws-accent transition-[width] duration-75 ease-out"
    />
  )
}
