import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS } from '@/lib/notion'

export const metadata: Metadata = {
  title: 'Browse by Section | AI This Week',
  description: 'Explore all Tool of the Week picks, Deep Dives, Bright Spots, and more across every issue.',
}

export default function SectionsPage() {
  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-4">
        Browse by section
      </h1>
      <p className="text-[19px] text-govuk-dark-grey mb-10 max-w-xl">
        Every issue is organised into sections. Browse all picks from a single section across
        every edition.
      </p>
      <ul className="space-y-4 list-none p-0">
        {SECTIONS.map(section => (
          <li key={section.slug}>
            <Link
              href={`/sections/${section.slug}`}
              className="flex items-center gap-4 border-2 border-govuk-black px-5 py-4 hover:bg-govuk-light-grey no-underline group"
            >
              <span className="text-[28px]" aria-hidden="true">{section.emoji}</span>
              <span className="text-[20px] font-bold text-govuk-blue group-hover:text-govuk-black underline group-hover:no-underline">
                {section.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
