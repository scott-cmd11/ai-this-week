import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getIssueBlocks, getPublishedIssues } from '@/lib/issue-store'
import { deriveIssueDigest } from '@/lib/issue-summary'
import { issueDisplayTitle, nonBreakingDate } from '@/lib/title'

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
  const latestBlocks = latest ? await getIssueBlocks(latest.id) : []
  const latestDigest = latest ? deriveIssueDigest(latestBlocks, latest) : null
  const latestSummary = latest ? (latest.summary || latestDigest?.summary || '') : ''
  const latestDevelopments = latestDigest?.keyDevelopments ?? []

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
        <section aria-label="Latest issue" className="mb-14 border-y border-ws-black py-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <article>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="type-meta text-ws-accent">Latest published</p>
                <p className="type-meta text-ws-muted">Issue {latest.issueNumber}</p>
              </div>

              <Link href={`/issues/${latest.slug}`} className="group no-underline">
                <h2 className="mt-4 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.9rem,7.4vw,6.15rem)] font-semibold leading-[0.92] text-ws-black group-hover:text-ws-accent">
                  {nonBreakingDate(issueDisplayTitle(latest.title))}
                </h2>
              </Link>

              {latestSummary && (
                <p className="mt-5 max-w-4xl text-[clamp(1.18rem,2.2vw,1.72rem)] leading-[1.35] text-ws-black">
                  {latestSummary}
                </p>
              )}

              {latestDevelopments.length > 0 && (
                <div className="mt-7 border-t border-ws-border pt-5">
                  <p className="type-meta text-ws-accent">Key developments</p>
                  <ol className="mt-4 grid list-none gap-4 p-0 sm:grid-cols-3">
                    {latestDevelopments.map((development, index) => (
                      <li key={`${index}-${development}`} className="border-t border-ws-border pt-3">
                        <span className="type-meta text-ws-accent">{String(index + 1).padStart(2, '0')}</span>
                        <p className="mt-2 text-[15px] leading-[1.55] text-ws-muted">
                          {development}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
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

            <aside aria-label="Latest issue file" className="border-t border-ws-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="type-meta text-ws-accent">Issue file</p>
              <dl className="mt-4 grid gap-0 divide-y divide-ws-border border-y border-ws-border">
                <div className="py-3">
                  <dt className="type-meta text-ws-muted">Stories</dt>
                  <dd className="mt-1 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
                    {latestDigest?.storyCount ?? 0}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="type-meta text-ws-muted">Sections</dt>
                  <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                    {latestDigest?.sections.slice(0, 3).join(' / ') || 'Briefing'}
                  </dd>
                </div>
                <div className="py-3">
                  <dt className="type-meta text-ws-muted">Standard</dt>
                  <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                    Source-linked, AI-assisted, editor-reviewed.
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section aria-label="Past issues" className="border-t border-ws-black pt-6">
          <div className="flex items-end justify-between gap-4">
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

          <details className="group mt-5 border-y border-ws-border">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-ws-black hover:text-ws-accent [&::-webkit-details-marker]:hidden">
              <span>
                <span className="type-button block">Show previous issues</span>
                <span className="mt-1 block text-[13px] leading-snug text-ws-muted">
                  {past.length} recent editions are tucked away to keep the front page focused.
                </span>
              </span>
              <span className="type-meta text-ws-accent group-open:hidden">Open</span>
              <span className="type-meta hidden text-ws-accent group-open:inline">Close</span>
            </summary>

            <ul className="m-0 grid list-none divide-y divide-ws-border border-t border-ws-border p-0">
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
          </details>
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
