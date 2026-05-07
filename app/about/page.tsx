import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'About | AI Today',
  description:
    'AI Today is a source-linked daily briefing on Canadian AI policy, public sector adoption, industry moves, research, and applied AI.',
}

const sections = [
  ['CAN', 'Canada', 'Canadian AI policy, companies, infrastructure, and adoption.'],
  ['POL', 'Policy & Regulation', 'Privacy, ethics, governance, copyright, and AI regulation.'],
  ['GOV', 'Government & Public Sector', 'Public-sector AI, defence, sovereign compute, and civic technology.'],
  ['IND', 'Industry & Models', 'Model releases, funding, companies, agents, coding tools, and infrastructure.'],
  ['APP', 'Sectors & Applications', 'Applied AI in health, agriculture, education, environment, jobs, and services.'],
  ['RES', 'Research', 'Notable research papers and technical signals, translated into plain language.'],
]

export default function AboutPage() {
  return (
    <>
      <section className="mb-10 overflow-hidden border-y border-ws-black bg-transparent">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="type-kicker">About the briefing</p>
            <h1 className="type-page-title mt-5">
              AI news, made usable.
            </h1>
            <p className="type-lede mt-6 max-w-3xl">
              AI Today is a source-linked daily briefing for professionals who need to understand
              AI without living inside AI news all day. It focuses on Canadian AI first, then pulls
              in the global policy, public-sector, industry, research, and applied-AI signals that
              are actually worth tracking.
            </p>
          </div>

          <div className="border-t border-ws-border p-6 text-ws-black sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="type-meta text-ws-accent">
              Publishing model
            </p>
            <ul className="mt-6 flex flex-col gap-5 text-[15px] leading-[1.5] text-ws-muted">
              <li>
                <strong className="type-card-title block">Daily issue</strong>
                Published from the admin workflow when the day&apos;s draft is ready.
              </li>
              <li>
                <strong className="type-card-title block">Source-linked cards</strong>
                Every story includes a direct link back to the original article or source.
              </li>
              <li>
                <strong className="type-card-title block">AI-assisted summaries</strong>
                Summaries are written in a consistent house style and are meant to guide, not replace, the source.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="How it works" className="mb-10 grid gap-4 md:grid-cols-3">
        <EditorialPanel>
          <p className="type-meta text-ws-accent">01</p>
          <h2 className="type-card-title mt-3">Collect</h2>
          <p className="type-body mt-2">
            Briefing feeds, research sources, events, and manually added links are gathered into a
            daily draft.
          </p>
        </EditorialPanel>

        <EditorialPanel>
          <p className="type-meta text-ws-accent">02</p>
          <h2 className="type-card-title mt-3">Summarize</h2>
          <p className="type-body mt-2">
            AI rewrites or generates plain-language summaries so each issue reads in one consistent voice.
          </p>
        </EditorialPanel>

        <EditorialPanel>
          <p className="type-meta text-ws-accent">03</p>
          <h2 className="type-card-title mt-3">Publish</h2>
          <p className="type-body mt-2">
            The final issue is published with source links, section structure, and article imagery when publishers expose it.
          </p>
        </EditorialPanel>
      </section>

      <section aria-label="Coverage" className="mb-10">
        <EditorialPanel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-kicker">Coverage</p>
              <h2 className="type-section-title mt-4">What shows up here</h2>
            </div>
            <Link href="/issues" className="type-meta text-ws-accent hover:text-ws-accent-hover">
              Browse issues
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sections.map(([code, title, description]) => (
              <div key={code} className="rounded-[0.65rem] border border-ws-border bg-[#fffaf0] p-4">
                <div className="flex items-center gap-3">
                  <span className="type-meta inline-flex h-7 items-center border border-ws-border bg-ws-white px-2.5 text-[10px] text-ws-accent">
                    {code}
                  </span>
                  <h3 className="type-card-title">{title}</h3>
                </div>
                <p className="type-body mt-3 text-[15px]">{description}</p>
              </div>
            ))}
          </div>
        </EditorialPanel>
      </section>

      <section aria-label="Disclosure" className="mb-10">
        <EditorialPanel tone="cream">
          <p className="type-kicker">Editorial disclosure</p>
          <h2 className="type-section-title mt-4">How AI is used</h2>
          <div className="type-body mt-5 grid gap-5 text-[17px] md:grid-cols-2">
            <p>
              Article summaries and event descriptions are AI-assisted. Titles and source links come
              from the original material, and each public story card points readers back to the
              source for verification.
            </p>
            <p>
              Summaries are meant to answer what happened and why it matters in plain English. They
              are not a substitute for the original article, especially on legal, policy, financial,
              medical, or technical claims.
            </p>
          </div>
        </EditorialPanel>
      </section>

      <section aria-label="Related project" className="mb-10">
        <EditorialPanel>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="type-kicker">Related project</p>
              <h2 className="type-section-title mt-4 text-[2rem]">AI Canada Pulse</h2>
              <p className="type-body mt-3 max-w-3xl text-[17px]">
                AI Canada Pulse is a companion site that tracks Canadian AI adoption, public-sector activity,
                infrastructure, policy, and market signals in more depth. AI Today is the daily briefing;
                AI Canada Pulse is the wider dashboard for the Canadian AI landscape.
              </p>
            </div>
            <a
              href="https://www.aicanadapulse.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ws-black px-5 py-3 text-[14px] font-semibold tracking-wide text-ws-white no-underline transition-colors hover:bg-ws-accent focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2"
            >
              Visit AI Canada Pulse
            </a>
          </div>
        </EditorialPanel>
      </section>

      <section aria-label="Contact" className="mb-10">
        <EditorialPanel>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="type-section-title text-[2rem]">Corrections and tips</h2>
              <p className="type-body mt-2 text-[17px]">
                Send corrections, source suggestions, or AI stories worth watching.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ws-accent px-5 py-3 text-[14px] font-semibold tracking-wide text-ws-white no-underline shadow-[0_12px_28px_rgba(223,72,36,0.24)] transition-colors hover:bg-ws-accent-hover focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2"
            >
              Contact AI Today
            </Link>
          </div>
        </EditorialPanel>
      </section>
    </>
  )
}

function EditorialPanel({
  children,
  tone = 'white',
}: {
  children: ReactNode
  tone?: 'white' | 'cream'
}) {
  return (
    <div className={`${tone === 'cream' ? 'bg-[#fffaf0]' : 'bg-ws-white'} border border-ws-border p-6`}>
      {children}
    </div>
  )
}
