import type { Metadata } from 'next'
import { NeoPopCard } from '@/components/NeoPop/NeoPopCard'

export const metadata: Metadata = {
  title: 'About | AI Today',
  description:
    'A daily link digest on artificial intelligence — Canadian news, global stories, and new research, written for non-technical professionals.',
}

export default function AboutPage() {
  return (
    <>
      <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        About AI Today
      </h1>
      <div className="w-16 h-[3px] bg-ws-accent mb-10" aria-hidden="true" />

      <section aria-label="About the newsletter" className="mb-10">
        <NeoPopCard bg="white" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">What is this?</h2>
          <p className="text-[19px] leading-[1.5] mb-4">
            AI Today is a daily digest of artificial intelligence news, written for
            professional, non-technical readers — people whose work touches AI without
            being AI specialists. Each issue brings together Canadian AI policy and
            companies, trending global stories, new research papers, and upcoming
            learning events worth knowing about.
          </p>
          <p className="text-[19px] leading-[1.5] font-bold">
            No jargon. No hype. Just what matters, in plain English.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="What you'll find" className="mb-10">
        <NeoPopCard bg="white" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">What you&apos;ll find in each issue</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3 text-[17px] leading-[1.5]">
            <li><span className="font-bold">🍁 Canada</span> — Canadian AI policy, companies, and adoption.</li>
            <li><span className="font-bold">⚖️ Policy &amp; Regulation</span> — privacy, ethics, governance.</li>
            <li><span className="font-bold">🏛️ Government &amp; Public Sector</span> — federal use, sovereign compute.</li>
            <li><span className="font-bold">💼 Industry &amp; Models</span> — investment, M&amp;A, models, agents, coding.</li>
            <li><span className="font-bold">🌾 Sectors &amp; Applications</span> — agriculture, environment, jobs, applied AI.</li>
            <li><span className="font-bold">🔬 Research</span> — trending papers from arXiv and Hugging Face.</li>
            <li><span className="font-bold">📅 Upcoming</span> — webinars, courses, conferences, meetups.</li>
          </ul>
          <p className="text-[15px] leading-[1.5] text-ws-muted mt-4">
            Not every section appears in every issue — only what&apos;s actually worth
            reading that day.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <NeoPopCard bg="cream" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">AI content disclosure</h2>
          <p className="text-[19px] leading-[1.5] mb-4">
            <strong>Article summaries, event descriptions, and the newsletter email
            are all written by AI</strong> in a consistent house style — plain language,
            active verbs, no jargon. Article titles come from the original source, unchanged.
          </p>
          <p className="text-[19px] leading-[1.5] mb-4">
            Every story links to its source — the title takes you there, and a small
            &ldquo;via [source]&rdquo; line at the end of each entry credits the publisher.
            Always follow the link for the authoritative version of any story.
          </p>
          <p className="text-[19px] leading-[1.5]">
            Summaries are reviewed for obvious errors and tone before each issue goes
            live. But AI text can misread nuance, miss context, or occasionally invent
            detail. Treat the summary as a pointer to the story, not the story itself.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="Contact" className="mb-10">
        <NeoPopCard bg="white" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">Contact</h2>
          <p className="text-[19px] leading-[1.5] mb-5">
            Questions, corrections, or a story to pass along? Send a message and
            I&apos;ll reply when I can. — Scott
          </p>
          <a
            href="/contact"
            className="inline-block border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[15px] px-5 py-3 shadow-[6px_6px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover no-underline"
          >
            ✦ Open contact form
          </a>
        </NeoPopCard>
      </section>
    </>
  )
}
