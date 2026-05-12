import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS, getSectionArticleCounts } from '@/lib/issue-store'

export const metadata: Metadata = {
  title: 'Browse by Section',
  description:
    'Explore AI Today coverage by Canadian AI, policy, public-sector, industry, applied AI, and research sections.',
  alternates: {
    canonical: '/sections',
  },
}

export default async function SectionsPage() {
  const counts = await getSectionArticleCounts()

  return (
    <>
      <p className="type-kicker mb-5">Sections</p>
      <section className="border-t border-ws-black pt-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <h1 className="type-page-title mb-4">
              Browse by section
            </h1>
            <p className="type-lede max-w-2xl">
              Every issue is organised into a stable editorial taxonomy. Start with Canada,
              then move through policy, public-sector, industry, applied, and research signals.
            </p>
          </div>
          <aside className="border-y border-ws-border py-4" aria-label="Section taxonomy">
            <p className="type-meta text-ws-accent">Taxonomy</p>
            <p className="mt-3 text-[15px] font-semibold leading-snug text-ws-black">
              {SECTIONS.length} stable desks keep the archive scannable as daily coverage grows.
            </p>
          </aside>
        </div>
      </section>

      <div className="section-rule my-10" aria-hidden="true" />
      <ul className="list-none divide-y divide-ws-border border-y border-ws-border p-0">
        {SECTIONS.map(section => (
          <li key={section.slug}>
            <Link
              href={`/sections/${section.slug}`}
              className="grid gap-3 px-0 py-5 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2 sm:grid-cols-[84px_minmax(0,1fr)_96px] sm:items-start sm:px-3"
            >
              <span className="type-meta inline-flex h-7 w-fit items-center border border-ws-border bg-[#fffaf0] px-2.5 text-[11px] text-ws-accent" aria-hidden="true">
                {section.code}
              </span>
              <span>
                <span className="block font-[family-name:var(--font-display)] text-[1.5rem] font-medium leading-tight text-ws-black">
                  {section.label}
                </span>
                <span className="mt-2 block max-w-2xl text-[15px] leading-[1.5] text-ws-muted">
                  {section.description}
                </span>
              </span>
              <span className="type-meta text-ws-muted sm:text-right">
                {counts[section.slug] ?? 0} picks
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
