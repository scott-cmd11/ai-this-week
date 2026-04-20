import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | AI This Week',
  description:
    'A weekly newsletter on Canadian AI news, trending global stories, and new research — written for non-technical professionals.',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black dark:text-white leading-tight mb-8">
        About AI This Week
      </h1>

      <section aria-label="About the newsletter" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black dark:text-white mb-4">What is this?</h2>
        <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5] mb-4">
          AI This Week is a weekly newsletter on artificial intelligence, written for
          professionals working in or alongside AI. It covers three things each week:
        </p>
        <ul className="text-[19px] text-govuk-black dark:text-white leading-[1.5] mb-4 list-disc pl-6 space-y-2">
          <li>
            <strong>Canadian AI news</strong> — policy, funding, companies, and research
            coming out of Canada, plus the global stories that affect Canadian industry
            and government.
          </li>
          <li>
            <strong>Trending stories</strong> — the biggest developments elsewhere that
            week, summarised without hype.
          </li>
          <li>
            <strong>New research</strong> — papers, tools, and technical breakthroughs
            explained in plain language.
          </li>
        </ul>
        <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5] mb-4">
          No jargon. No hype. Just what matters, in plain English.
        </p>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black dark:text-white mb-4">AI content disclosure</h2>
        <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5] mb-4">
          Some article summaries on this site are drafted with AI assistance.
          All AI-assisted content is reviewed and edited by a human editor before
          publication. Issues that contain AI-assisted summaries are marked with
          a disclosure notice at the top of the page.
        </p>
        <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5]">
          This disclosure is provided in the interest of transparency. If you
          have questions about our editorial process, contact us directly.
        </p>
      </section>
    </>
  )
}
