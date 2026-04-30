'use client'

// ─── Floating section breadcrumb ────────────────────────────────────────────────
// As the reader scrolls through a long issue, a small chip at the top of the
// viewport quietly tells them which section they're currently in. Clicking
// the chip jumps back to that section's header. Hidden until the reader has
// scrolled past the article H1 (no point showing it at the very top).
//
// Mobile-friendly: chip is small and stays out of the way.
// Uses native IntersectionObserver for scroll-spy — no animation, no jitter,
// no scroll-jacking.

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from '@/lib/category-mapping'

const EXTRA_META: Record<string, { icon: string }> = {
  Upcoming: { icon: '📅' },
}

interface Section {
  id: string
  label: string
}

interface Props {
  sections: Section[]
}

export function SectionProgress({ sections }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scroll-spy: track which section header is currently in or above the viewport.
  // The "active" section is the most-recently-passed header, so the chip stays
  // visible while reading articles below it (not just when the header is on screen).
  useEffect(() => {
    if (sections.length === 0) return

    // Track each section's top position as it crosses the viewport
    const positions = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      records => {
        for (const r of records) {
          positions.set(r.target.id, r.boundingClientRect.top)
        }
        // Pick the section whose header is closest to (but above) the top of the viewport.
        // This way, while reading articles BELOW a header, that header is still "active."
        const candidates = [...positions.entries()].filter(([, top]) => top < 80)
        if (candidates.length === 0) {
          setActiveId(null)
          return
        }
        // Most recent (largest top value among those above viewport)
        candidates.sort((a, b) => b[1] - a[1])
        setActiveId(candidates[0][0])
      },
      { rootMargin: '0px 0px -85% 0px', threshold: [0, 1] },
    )

    for (const { id } of sections) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [sections])

  // Show only after the user has scrolled past the article H1 — no point
  // showing a "you are in X section" chip when the issue title is still on screen.
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 240)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (sections.length < 2) return null

  const active = sections.find(s => s.id === activeId)
  if (!active) return null

  // Look up the icon — same rules as SectionHeader in notion-renderer.tsx
  const icon =
    (CATEGORY_ORDER as readonly string[]).includes(active.label)
      ? CATEGORY_META[active.label as Category].icon
      : EXTRA_META[active.label]?.icon ?? '·'

  return (
    <a
      href={`#${active.id}`}
      aria-label={`Jump to top of ${active.label} section`}
      className={[
        'fixed top-3 left-1/2 -translate-x-1/2 z-40',
        'flex items-center gap-2 px-3 py-1.5',
        'bg-ws-black text-ws-white no-underline',
        'border-[2px] border-ws-black',
        'shadow-[3px_3px_0_0_var(--color-ws-accent)]',
        'text-[12px] font-black uppercase tracking-[0.1em]',
        'transition-opacity duration-200',
        visible ? 'opacity-95 hover:opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      <span aria-hidden="true" className="text-[14px] leading-none">{icon}</span>
      <span className="max-w-[16ch] truncate">{active.label}</span>
    </a>
  )
}
