import type { Metadata } from 'next'
import { NeoPopCard } from '@/components/NeoPop/NeoPopCard'

export const metadata: Metadata = {
  title: 'About | AI This Week',
  description:
    'A weekly newsletter on Canadian AI news, trending global stories, and new research — written for non-technical professionals.',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        About AI This Week
      </h1>
      <div className="w-20 h-[6px] bg-neopop-red mb-10" aria-hidden="true" />

      <section aria-label="About the newsletter" className="mb-10">
        <NeoPopCard bg="white" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">What is this?</h2>
          <p className="text-[19px] leading-[1.5] mb-4">
            AI This Week is a weekly newsletter on artificial intelligence, written for
            professionals working in or alongside AI. It covers three things each week:
          </p>
          <ul className="text-[19px] leading-[1.5] mb-4 list-none pl-0 space-y-3">
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-neopop-red font-black shrink-0">▸</span>
              <span>
                <strong className="uppercase tracking-wide text-[17px] block">Canadian AI news</strong>
                Policy, funding, companies, and research coming out of Canada — plus the global stories
                that affect Canadian industry and government.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-neopop-red font-black shrink-0">▸</span>
              <span>
                <strong className="uppercase tracking-wide text-[17px] block">Trending stories</strong>
                The biggest developments elsewhere that week, summarised without hype.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-neopop-red font-black shrink-0">▸</span>
              <span>
                <strong className="uppercase tracking-wide text-[17px] block">New research</strong>
                Papers, tools, and technical breakthroughs explained in plain language.
              </span>
            </li>
          </ul>
          <p className="text-[19px] leading-[1.5] font-bold">
            No jargon. No hype. Just what matters, in plain English.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <NeoPopCard bg="cream" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">AI content disclosure</h2>
          <p className="text-[19px] leading-[1.5] mb-4">
            Some article summaries on this site are drafted with AI assistance.
            All AI-assisted content is reviewed and edited by a human editor before
            publication. Issues that contain AI-assisted summaries are marked with
            a disclosure notice at the top of the page.
          </p>
          <p className="text-[19px] leading-[1.5]">
            This disclosure is provided in the interest of transparency. If you
            have questions about our editorial process, contact us directly.
          </p>
        </NeoPopCard>
      </section>
    </>
  )
}
