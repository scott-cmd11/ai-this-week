import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS } from '@/lib/notion'

export const metadata: Metadata = {
  title: 'Browse by Section',
  description:
    'Explore AI Today coverage by Canadian AI, policy, public-sector, industry, applied AI, and research sections.',
  alternates: {
    canonical: '/sections',
  },
}

export default function SectionsPage() {
  return (
    <>
      <p className="type-kicker mb-5">Sections</p>
      <h1 className="type-page-title mb-4">
        Browse by section
      </h1>
      <div className="section-rule mb-6" aria-hidden="true" />
      <p className="type-lede mb-10 max-w-xl">
        Every issue is organised into a stable editorial taxonomy. Browse coverage from one
        section across every edition.
      </p>
      <ul className="space-y-5 list-none p-0">
        {SECTIONS.map(section => (
          <li key={section.slug}>
            <Link
              href={`/sections/${section.slug}`}
              className="flex items-center gap-4 border-y border-ws-border px-6 py-4 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2"
            >
              <span className="type-meta border border-ws-border bg-[#fffaf0] px-2.5 py-1 text-[11px] text-ws-accent" aria-hidden="true">
                {section.code}
              </span>
              <span className="type-card-title">
                {section.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
