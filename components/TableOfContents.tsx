'use client'

import { useEffect, useRef, useState } from 'react'

interface TocEntry {
  id: string
  label: string
}

interface Props {
  entries: TocEntry[]
}

export function TableOfContents({ entries }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (entries.length === 0) return

    // Track the topmost visible heading
    const visible = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (records) => {
        for (const entry of records) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top)
          } else {
            visible.delete(entry.target.id)
          }
        }
        if (visible.size === 0) return
        // Pick the one closest to the top of the viewport
        const topmost = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]
        setActiveId(topmost[0])
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    for (const { id } of entries) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [entries])

  if (entries.length < 3) return null

  return (
    <nav
      aria-label="Table of contents"
      className="hidden xl:block sticky top-8 self-start w-56 shrink-0"
    >
      <p className="text-[13px] font-bold text-govuk-dark-grey uppercase tracking-wide mb-3">
        Contents
      </p>
      <ol className="list-none p-0 space-y-1">
        {entries.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={[
                'block text-[14px] leading-[1.4] py-0.5 border-l-4 pl-3 no-underline hover:underline',
                activeId === id
                  ? 'border-govuk-blue text-govuk-blue font-bold'
                  : 'border-transparent text-govuk-dark-grey hover:text-govuk-black',
              ].join(' ')}
            >
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
