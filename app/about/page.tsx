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
            AI Today is a daily link digest on artificial intelligence, written for
            professionals working in or alongside AI. Every day there&apos;s something
            worth reading — a policy update, a new tool, a research paper, a
            development that changes how the industry works. This is where those
            links land, with a short note on why they matter.
          </p>
          <p className="text-[19px] leading-[1.5] font-bold">
            No jargon. No hype. Just what matters, in plain English.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="AI content disclosure" className="mb-10">
        <NeoPopCard bg="cream" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">AI content disclosure</h2>
          <p className="text-[19px] leading-[1.5] mb-4">
            <strong>All summaries on this site are AI-generated.</strong> Always go
            to the original source — linked beneath each summary as &ldquo;Read
            more&rdquo; — for the authoritative version of any story.
          </p>
          <p className="text-[19px] leading-[1.5]">
            Minor editing happens prior to publishing: summaries are reviewed for
            obvious errors and tone before each issue goes live. But AI-generated
            text can misread nuance, miss context, or occasionally invent detail.
            Treat summaries as a pointer to the story, not the story itself.
          </p>
        </NeoPopCard>
      </section>

      <section aria-label="Contact" className="mb-10">
        <NeoPopCard bg="white" interactive={false}>
          <h2 className="text-[28px] font-black uppercase tracking-tight mb-4">Contact</h2>
          <p className="text-[19px] leading-[1.5] mb-5">
            Questions, corrections, or a story to pass along? Send a message and
            I&apos;ll reply when I can.
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
