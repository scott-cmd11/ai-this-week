import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { nonBreakingDate } from '@/lib/title'
import { NeoPopCard } from '@/components/NeoPop/NeoPopCard'
import { NeoPopButton } from '@/components/NeoPop/NeoPopButton'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI Today — AI news for non-technical professionals',
  description:
    'Canadian AI news, trending global stories, and new research — delivered daily for professional, non-technical readers. No hype, no jargon.',
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function HomePage() {
  const issues = await getPublishedIssues()
  const [latest, ...allPast] = issues
  const past = allPast.slice(0, 5)

  return (
    <>
      {/* Hero */}
      <section aria-label="About this newsletter" className="mb-12">
        <NeoPopCard bg="yellow">
          <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
            AI news for people who aren&apos;t AI people.
          </h1>
          <div className="w-16 h-[3px] bg-ws-accent mb-5" aria-hidden="true" />
          <p className="text-[22px] leading-[1.4] max-w-2xl font-medium">
            Every day: Canadian AI news, trending global stories, and new research —
            written for professional, non-technical readers. No hype, no jargon.
          </p>
        </NeoPopCard>
      </section>

      {/* Latest issue */}
      {latest && (
        <section aria-label="Latest issue" className="mb-14">
          <p className="text-[14px] font-black uppercase tracking-[0.15em] mb-4 inline-block bg-ws-accent text-ws-white px-3 py-1">
            Latest issue
          </p>
          <NeoPopCard bg="white">
            <div className="flex gap-3 text-[14px] font-bold uppercase tracking-wide mb-3">
              <span>Issue {latest.issueNumber}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={latest.issueDate}>{formatDate(latest.issueDate)}</time>
            </div>
            <h2 className="text-[26px] sm:text-[32px] md:text-[36px] font-black uppercase leading-[1.05] tracking-tight mb-4">
              <Link href={`/issues/${latest.slug}`} className="text-ws-black hover:text-ws-accent no-underline">
                {nonBreakingDate(latest.title)}
              </Link>
            </h2>
            {latest.summary && (
              <p className="text-[17px] sm:text-[19px] leading-[1.5] mb-6 max-w-2xl">{latest.summary}</p>
            )}
            <NeoPopButton href={`/issues/${latest.slug}`} variant="primary">
              Read this issue →
            </NeoPopButton>
          </NeoPopCard>
        </section>
      )}

      {/* AI Canada Pulse crosslink */}
      <section aria-label="Related resource" className="mb-14">
        <div className="border-l-[4px] border-ws-accent pl-5 py-1">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ws-muted mb-2">Also from Scott Hazlitt</p>
          <h2 className="text-[20px] sm:text-[24px] font-black uppercase tracking-tight leading-tight mb-2">
            <a
              href="https://www.aicanadapulse.ca/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ws-black hover:text-ws-accent no-underline"
            >
              AI Canada Pulse →
            </a>
          </h2>
          <p className="text-[16px] leading-[1.5] text-ws-muted max-w-xl">
            Canadian AI activity tracked hourly — every story, economic indicators, and
            deeper data for when today&apos;s digest isn&apos;t enough.
          </p>
        </div>
      </section>

      {/* Past issues */}
      {past.length > 0 && (
        <section aria-label="Past issues">
          <h2 className="text-[26px] sm:text-[32px] font-black uppercase tracking-tight mb-6">Past issues</h2>
          <ul className="list-none p-0 m-0 divide-y divide-ws-border border-t border-ws-border">
            {past.map(issue => (
              <li key={issue.id}>
                <Link
                  href={`/issues/${issue.slug}`}
                  className="flex items-baseline justify-between gap-4 py-4 group no-underline"
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="text-[12px] font-black uppercase tracking-[0.1em] text-ws-muted shrink-0">
                      #{issue.issueNumber}
                    </span>
                    <span className="text-[17px] font-black leading-snug text-ws-black group-hover:text-ws-accent transition-colors truncate">
                      {nonBreakingDate(issue.title)}
                    </span>
                  </div>
                  <time
                    dateTime={issue.issueDate}
                    className="text-[12px] font-bold text-ws-muted shrink-0 hidden sm:block"
                  >
                    {formatDate(issue.issueDate)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
          {allPast.length > 5 && (
            <div className="mt-5 pt-4 border-t border-ws-border">
              <Link
                href="/issues"
                className="text-[13px] font-black uppercase tracking-[0.1em] text-ws-accent hover:text-ws-accent-hover underline underline-offset-2"
              >
                View all {allPast.length + 1} issues →
              </Link>
            </div>
          )}
        </section>
      )}

      {issues.length === 0 && (
        <NeoPopCard bg="white" interactive={false}>
          <p className="text-[19px] font-bold">No issues published yet.</p>
          <p className="text-[15px] mt-2">Once the first issue is published it will appear here.</p>
        </NeoPopCard>
      )}
    </>
  )
}
