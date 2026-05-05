import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { issueDisplayTitle, nonBreakingDate } from '@/lib/title'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI Today - Canadian AI briefing',
  description:
    'Canadian AI policy, companies, public-sector adoption, global signals, and research in one plain-English daily briefing.',
}

export default async function HomePage() {
  const issues = await getPublishedIssues()
  const [latest, ...allPast] = issues
  const past = allPast.slice(0, 6)

  return (
    <>
      <section aria-label="Publication introduction" className="mb-10 border-y border-ws-black py-8">
        <p className="type-meta mb-4 text-ws-accent">Canadian AI signal, daily</p>
        <h1 className="max-w-4xl font-[family-name:var(--font-display)] text-[clamp(3rem,8vw,6rem)] font-semibold leading-[0.96] text-ws-black">
          A plain-English briefing for people tracking Canadian AI.
        </h1>
        <p className="mt-6 max-w-3xl text-[17px] leading-[1.6] text-ws-muted">
          Policy, public-sector adoption, companies, models, research, and source-linked global context when it matters.
        </p>
      </section>

      {latest && (
        <section aria-label="Latest issue" className="mb-12">
          <article className="border-b border-ws-border pb-8">
            <div className="type-meta flex flex-wrap gap-3 text-ws-accent">
              <span>Latest published issue</span>
              <span aria-hidden="true">/</span>
              <span>Issue {latest.issueNumber}</span>
            </div>
            <p className="type-meta mt-3 text-ws-muted">
              Today&apos;s issue is published in the evening.
            </p>

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
              <p className="type-meta text-ws-muted">
                Source-linked / AI-assisted / Canada-first
              </p>
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
