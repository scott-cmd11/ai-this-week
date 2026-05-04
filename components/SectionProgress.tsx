'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from '@/lib/category-mapping'

const EXTRA_META: Record<string, { icon: string }> = {
  Upcoming: { icon: 'UP' },
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

  useEffect(() => {
    if (sections.length === 0) return

    const positions = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      records => {
        for (const r of records) {
          positions.set(r.target.id, r.boundingClientRect.top)
        }

        const candidates = [...positions.entries()].filter(([, top]) => top < 80)
        if (candidates.length === 0) {
          setActiveId(null)
          return
        }

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

  const icon =
    (CATEGORY_ORDER as readonly string[]).includes(active.label)
      ? CATEGORY_META[active.label as Category].icon
      : EXTRA_META[active.label]?.icon ?? ''

  return (
    <a
      href={`#${active.id}`}
      aria-label={`Jump to top of ${active.label} section`}
      className={[
        'fixed top-3 left-1/2 z-40 -translate-x-1/2',
        'flex items-center gap-2 px-3 py-1.5',
        'rounded-full bg-ws-black/92 text-ws-white no-underline backdrop-blur',
        'border border-white/12',
        'shadow-[0_12px_28px_rgba(20,17,15,0.22)]',
        'type-button text-[12px]',
        'transition-[opacity,background-color] duration-200',
        visible ? 'opacity-95 hover:opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
    >
      {icon && (
        <span aria-hidden="true" className="rounded-full border border-white/18 px-1.5 py-0.5 text-[9px] leading-none text-ws-accent-light">
          {icon}
        </span>
      )}
      <span className="max-w-[16ch] truncate">{active.label}</span>
    </a>
  )
}
