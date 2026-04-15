import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About | AI This Week',
  description: 'About AI This Week and our AI content disclosure.',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-8">
        About AI This Week
      </h1>

      <section aria-label="About the newsletter" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black mb-4">What is this?</h2>
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          AI This Week is a weekly newsletter covering the latest developments in
          artificial intelligence — from policy and workforce impact to technical
          research and new tools. It is written for professionals working in or
          alongside AI.
        </p>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <h2 className="text-[27px] font-bold text-govuk-black mb-4">AI content disclosure</h2>
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          Some article summaries on this site are drafted with AI assistance.
          All AI-assisted content is reviewed and edited by a human editor before
          publication. Issues that contain AI-assisted summaries are marked with
          a disclosure notice at the top of the page.
        </p>
        <p className="text-[19px] text-govuk-black leading-[1.5]">
          This disclosure is provided in the interest of transparency. If you
          have questions about our editorial process, contact us directly.
        </p>
      </section>
    </>
  )
}
