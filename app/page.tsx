import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { issueDisplayTitle, nonBreakingDate } from '@/lib/title'
import { SignalLedger } from '@/components/SignalLedger'

export const revalidate = 300

export const metadata: Metadata = {
  title: {
    absolute: 'AI Today - Canadian AI briefing',
  },
  description:
    'Canadian AI policy, companies, public-sector adoption, global signals, and research in one plain-English daily briefing.',
  alternates: {
    canonical: '/',
  },
}

export default async function HomePage() {
  const issues = await getPublishedIssues()
  const [latest, ...allPast] = issues
  const past = allPast.slice(0, 6)

  return (
    <>
      <section aria-label="Publication introduction" className="mb-10 border-y border-ws-black py-7">
        <p className="type-meta mb-4 text-ws-accent">Canadian AI signal, daily</p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-[clamp(2.65rem,6vw,4.75rem)] font-medium leading-[0.98] text-ws-black">
          Canadian AI, in plain English.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-[1.6] text-ws-muted">
          A daily briefing for policy, public-sector, and industry readers tracking what changed, why it matters, and where the source record points.
        </p>

        <figure className="mt-8 grid overflow-hidden border-y border-ws-border lg:grid-cols-[240px_minmax(0,1fr)]">
          <figcaption className="border-b border-ws-border py-3 lg:border-b-0 lg:border-r lg:pr-5">
            <p className="type-meta text-ws-accent">Signal desk</p>
            <p className="mt-2 text-[13px] leading-[1.45] text-ws-muted">
              Canada-first coverage with linked public sources.
            </p>
          </figcaption>
          <div className="relative h-34 min-h-[8.5rem] overflow-hidden sm:h-40 lg:h-44">
            <Image
              src="/images/homepage-signal-map-v2.png"
              alt="Abstract dotted map of Canada with restrained data signal marks."
              fill
              priority
              sizes="(min-width: 1024px) 44vw, 100vw"
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-ws-page/20" aria-hidden="true" />
          </div>
        </figure>
      </section>

      {latest && (
        <section aria-label="Latest issue" className="mb-12">
          <article className="border-b border-ws-border pb-8">
            <SignalLedger
              items={[
                { label: 'Latest published', value: `Issue ${latest.issueNumber}` },
                { label: 'Editorial standard', value: 'Source-linked, AI-assisted, Canada-first.' },
              ]}
            />

            <Link href={`/issues/${latest.slug}`} className="group no-underline">
              <h2 className="mt-4 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.94] text-ws-black group-hover:text-ws-accent">
                {nonBreakingDate(issueDisplayTitle(latest.title))}
              </h2>
            </Link>

            {latest.summary && (
              <p className="mt-5 max-w-3xl text-[18px] leading-[1.6] text-ws-muted">
                {latest.summary}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={`/issues/${latest.slug}`}
                className="type-button inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover"
              >
                Open the issue
              </Link>
            </div>
          </article>
        </section>
      )}

      {past.length > 0 && (
        <section aria-label="Past issues" className="border-t border-ws-black pt-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="type-meta text-ws-accent">Archive</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[2.25rem] font-semibold leading-none text-ws-black">
                Previous issues
              </h2>
            </div>
            <Link href="/issues" className="type-meta text-ws-accent hover:text-ws-accent-hover">
              All issues
            </Link>
          </div>

          <ul className="m-0 grid list-none divide-y divide-ws-border border-y border-ws-border p-0">
            {past.map(issue => (
              <li key={issue.id}>
                <Link
                  href={`/issues/${issue.slug}`}
                  className="grid gap-2 py-4 no-underline transition-colors hover:bg-ws-white/60 sm:grid-cols-[90px_1fr] sm:items-baseline"
                >
                  <span className="type-meta text-ws-accent">#{issue.issueNumber}</span>
                  <span className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold leading-tight text-ws-black">
                    {nonBreakingDate(issueDisplayTitle(issue.title))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {issues.length === 0 && (
        <div className="border-y border-ws-border py-6">
          <p className="type-card-title">No issues published yet.</p>
          <p className="type-body mt-2 text-[15px]">Once the first issue is published it will appear here.</p>
        </div>
      )}
    </>
  )
}
