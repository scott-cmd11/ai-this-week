import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { nonBreakingDate } from '@/lib/title'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI Today - Canadian AI briefing',
  description:
    'Canadian AI policy, companies, public-sector adoption, global signals, and research in one plain-English daily briefing.',
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysSince(isoDate: string): number {
  const today = new Date()
  const issueDate = new Date(isoDate + 'T12:00:00')
  return Math.max(0, Math.floor((today.getTime() - issueDate.getTime()) / 86_400_000))
}

const deskNotes = [
  'Canada-first coverage, with global AI stories included when they change the context.',
  'Every public story card links back to its original source.',
  'Summaries are AI-assisted and written for quick professional reading.',
]

export default async function HomePage() {
  const issues = await getPublishedIssues()
  const [latest, ...allPast] = issues
  const past = allPast.slice(0, 6)

  return (
    <>
      <section aria-label="AI Today masthead" className="mb-8 border-y border-ws-black py-6 text-center">
        <p className="type-meta mb-3 text-ws-accent">Canadian AI signal, daily</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(4rem,13vw,8.5rem)] font-semibold leading-[0.96] tracking-[-0.01em] text-ws-black">
          AI Today
        </h1>
        <p className="mx-auto mt-7 max-w-3xl text-[15px] leading-[1.55] text-ws-muted sm:mt-8 sm:text-[16px]">
          A plain-English briefing on AI policy, public-sector adoption, companies, models,
          research, and the Canadian stories that deserve more than a passing headline.
        </p>
      </section>

      {latest && (
        <section aria-label="Latest issue" className="mb-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.68fr)_minmax(280px,0.32fr)]">
            <article className="border-b border-ws-border pb-7 lg:border-b-0 lg:border-r lg:pr-8">
              <div className="type-meta flex flex-wrap gap-3 text-ws-accent">
                <span>Issue {latest.issueNumber}</span>
                <span aria-hidden="true">/</span>
                <time dateTime={latest.issueDate}>{formatDate(latest.issueDate)}</time>
                <span aria-hidden="true">/</span>
                <span>{daysSince(latest.issueDate) === 0 ? 'Updated today' : `${daysSince(latest.issueDate)} days old`}</span>
              </div>

              <Link href={`/issues/${latest.slug}`} className="group no-underline">
                <h2 className="mt-4 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(2.5rem,6vw,5.15rem)] font-semibold leading-[0.94] tracking-[-0.01em] text-ws-black group-hover:text-ws-accent">
                  {nonBreakingDate(latest.title)}
                </h2>
              </Link>

              {latest.summary && (
                <p className="mt-5 max-w-3xl text-[18px] leading-[1.6] text-ws-muted">
                  {latest.summary}
                </p>
              )}

              <div className="mt-6">
                <Link
                  href={`/issues/${latest.slug}`}
                  className="type-button inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover"
                >
                  Open the issue
                </Link>
              </div>
            </article>

            <aside className="grid content-start gap-6">
              <div>
                <p className="type-meta text-ws-accent">Editor&apos;s desk</p>
                <ul className="mt-4 grid gap-4">
                  {deskNotes.map(note => (
                    <li key={note} className="border-t border-ws-border pt-4 text-[15px] leading-[1.55] text-ws-muted first:border-t-0 first:pt-0">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-ws-black pt-5">
                <p className="type-meta text-ws-accent">Coverage</p>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] font-semibold text-ws-black">
                  <span>Canada</span>
                  <span>Policy</span>
                  <span>Government</span>
                  <span>Industry</span>
                  <span>Applications</span>
                  <span>Research</span>
                </div>
              </div>
            </aside>
          </div>
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
                  className="grid gap-2 py-4 no-underline transition-colors hover:bg-ws-white/60 sm:grid-cols-[90px_1fr_150px] sm:items-baseline"
                >
                  <span className="type-meta text-ws-accent">#{issue.issueNumber}</span>
                  <span className="font-[family-name:var(--font-display)] text-[1.35rem] font-semibold leading-tight text-ws-black">
                    {nonBreakingDate(issue.title)}
                  </span>
                  <time dateTime={issue.issueDate} className="type-meta normal-case tracking-[0.02em] sm:text-right">
                    {formatDate(issue.issueDate)}
                  </time>
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
