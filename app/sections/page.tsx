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
      <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        Browse by section
      </h1>
      <div className="w-16 h-[3px] bg-ws-accent mb-6" aria-hidden="true" />
      <p className="text-[19px] mb-10 max-w-xl">
        Every issue is organised into sections. Browse all picks from a single section across
        every edition.
      </p>
      <ul className="space-y-5 list-none p-0">
        {SECTIONS.map(section => (
          <li key={section.slug}>
            <Link
              href={`/sections/${section.slug}`}
              className="flex items-center gap-4 border-[3px] border-ws-black bg-ws-white px-6 py-4 no-underline shadow-[6px_6px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 ease-out hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-ws-black)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-ws-black)]"
            >
              <span className="text-[28px]" aria-hidden="true">{section.emoji}</span>
              <span className="text-[20px] font-black uppercase tracking-wide text-ws-black">
                {section.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
