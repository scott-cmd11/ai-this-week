import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About AI Good News',
  description: 'How AI Good News highlights positive, verifiable AI stories without hype.',
  alternates: {
    canonical: '/positive-ai/about',
  },
}

export default function GoodNewsAboutPage() {
  return (
    <>
      <p className="type-kicker mb-5">About AI Good News</p>
      <section className="border-t border-ws-black pt-6">
        <h1 className="type-page-title mb-5 max-w-4xl">
          Hopeful does not mean gullible.
        </h1>
        <p className="type-lede max-w-3xl">
          AI Good News highlights positive, verifiable stories about artificial intelligence helping people and institutions.
          It is designed as a daily newspaper for useful AI progress, not a product-launch feed or stock-market tracker.
        </p>
      </section>

      <div className="section-rule my-10" aria-hidden="true" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="grid gap-8">
          <RuleBlock
            title="What belongs"
            body="Stories about AI improving health care, education, accessibility, science, climate work, productivity, safety, small businesses, creativity, and public services. Strong stories include named organizations, measured outcomes, credible examples, or original research."
          />
          <RuleBlock
            title="What the desk favours"
            body="Source-linked reporting with a clear public-good angle, measured outcomes, named institutions, and useful human benefit over market chatter, unsupported opinion, duplicate syndication, or product promotion."
          />
          <RuleBlock
            title="How claims are framed"
            body="The site avoids saying AI solves a problem unless the source proves it. Preferred wording includes may help, is being used to, early results suggest, and researchers report."
          />
          <section id="scoring" className="scroll-mt-24 border-y border-ws-border py-6">
            <p className="type-meta text-ws-accent">How the scores work</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
              The numbers are signals, not verdicts.
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <ScoreNote
                label="Credibility"
                body="A 0-100 signal based on source quality, a working source link, evidence language, named institutions, research, pilots, deployments, or measured outcomes."
              />
              <ScoreNote
                label="Positivity"
                body="A 0-100 signal for clear beneficial AI use: helping people, improving access, supporting discovery, reducing harm, or making useful work easier."
              />
              <ScoreNote
                label="Evidence check"
                body="A short note showing why the story qualified. It should make the human benefit and source basis visible before a reader opens the original article."
              />
            </div>
            <p className="mt-5 max-w-3xl text-[15px] leading-[1.6] text-ws-muted">
              Scores are deliberately conservative. Stories can be rejected when they are positive but not clearly about AI, when the source is too promotional, or when the framing is mainly about layoffs, fear, markets, lawsuits, surveillance, bias, misinformation, or military harm.
            </p>
          </section>
        </section>

        <aside className="border-y border-ws-border py-4">
          <p className="type-meta text-ws-accent">Editorial standard</p>
          <ul className="mt-4 m-0 list-none divide-y divide-ws-border border-y border-ws-border p-0">
            {['Original source link', 'Date and source name', '2-sentence summary', 'Why this matters', 'Evidence check', 'Credibility score'].map(item => (
              <li key={item} className="py-3 text-[15px] font-semibold leading-snug text-ws-black">
                {item}
              </li>
            ))}
          </ul>
          <Link href="/positive-ai/archive" className="type-button mt-5 inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover">
            Browse the archive
          </Link>
        </aside>
      </div>
    </>
  )
}

function RuleBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="border-y border-ws-border py-6">
      <p className="type-meta text-ws-accent">{title}</p>
      <p className="mt-3 max-w-3xl text-[17px] leading-[1.65] text-ws-muted">{body}</p>
    </section>
  )
}

function ScoreNote({ label, body }: { label: string; body: string }) {
  return (
    <div className="border-t border-ws-border pt-4">
      <p className="type-meta text-ws-accent">{label}</p>
      <p className="mt-2 text-[15px] leading-[1.55] text-ws-muted">{body}</p>
    </div>
  )
}
