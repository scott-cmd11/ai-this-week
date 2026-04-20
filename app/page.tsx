import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { IssueCard } from '@/components/IssueCard'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI This Week — AI news for non-technical professionals',
  description:
    'Canadian AI news, trending global stories, and new research — delivered weekly for professional, non-technical readers. No hype, no jargon.',
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function HomePage() {
  const issues = await getPublishedIssues()
  const [latest, ...past] = issues

  return (
    <>
      {/* Hero */}
      <section aria-label="About this newsletter" className="border-b-4 border-govuk-black pb-10 mb-10">
        <h1 className="text-[48px] font-bold text-govuk-black dark:text-white leading-tight mb-4">
          AI news for people who aren&apos;t AI people.
        </h1>
        <p className="text-[22px] text-govuk-dark-grey leading-[1.5] max-w-2xl">
          Every week, the most important stories in artificial intelligence — written for
          professional, non-technical readers. No hype, no jargon. Just what matters, in
          plain English.
        </p>
      </section>

      {/* Latest issue */}
      {latest && (
        <section aria-label="Latest issue" className="mb-14">
          <p className="text-[16px] font-bold text-govuk-dark-grey uppercase tracking-wide mb-3">
            Latest issue
          </p>
          <div className="border-l-4 border-govuk-black pl-6">
            <div className="flex gap-3 text-[16px] text-govuk-dark-grey mb-2">
              <span>Issue {latest.issueNumber}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={latest.issueDate}>{formatDate(latest.issueDate)}</time>
            </div>
            <h2 className="text-[32px] font-bold text-govuk-black dark:text-white leading-tight mb-3">
              <Link
                href={`/issues/${latest.slug}`}
                className="text-govuk-blue underline hover:text-govuk-black"
              >
                {latest.title}
              </Link>
            </h2>
            {latest.summary && (
              <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5] mb-4 max-w-2xl">
                {latest.summary}
              </p>
            )}
            <Link
              href={`/issues/${latest.slug}`}
              className="inline-block bg-govuk-black text-white font-bold text-[17px] px-5 py-3 hover:bg-govuk-dark-grey"
            >
              Read this issue
            </Link>
          </div>
        </section>
      )}

      {/* Archive */}
      {past.length > 0 && (
        <section aria-label="Past issues">
          <h2 className="text-[27px] font-bold text-govuk-black dark:text-white mb-6">Past issues</h2>
          <ul className="space-y-8 list-none p-0">
            {past.map(issue => (
              <li key={issue.id}>
                <IssueCard issue={issue} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {issues.length === 0 && (
        <p className="text-[19px] text-govuk-dark-grey">No issues published yet.</p>
      )}
    </>
  )
}
