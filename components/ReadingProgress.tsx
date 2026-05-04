'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement
      const scrolled = el.scrollTop
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const rounded = Math.round(progress)
  const showLabel = rounded >= 3 && rounded < 100

  return (
    <>
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ width: `${progress}%` }}
        className="pointer-events-none fixed left-0 top-0 z-50 h-[4px] bg-ws-accent transition-[width] duration-75 ease-out"
      />
      <div
        aria-hidden="true"
        className={[
          'pointer-events-none fixed right-3 top-3 z-50 rounded-full border border-ws-border bg-ws-page/92 px-2.5 py-1 text-[11px] font-semibold tabular-nums tracking-[0.04em] text-ws-muted shadow-[0_8px_20px_rgba(20,17,15,0.08)] backdrop-blur-md transition-opacity duration-150',
          showLabel ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {rounded}% read
      </div>
    </>
  )
}
