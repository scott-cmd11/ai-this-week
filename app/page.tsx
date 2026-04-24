import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedIssues } from '@/lib/notion'
import { nonBreakingDate } from '@/lib/title'
import { NeoPopCard } from '@/components/NeoPop/NeoPopCard'
import { NeoPopButton } from '@/components/NeoPop/NeoPopButton'

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
      <section aria-label="About this newsletter" className="mb-12">
        <NeoPopCard bg="yellow">
          <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
            AI news for people who aren&apos;t AI people.
          </h1>
          <div className="w-16 h-[3px] bg-ws-accent mb-5" aria-hidden="true" />
          <p className="text-[22px] leading-[1.4] max-w-2xl font-medium">
            Every week: Canadian AI news, trending global stories, and new research —
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
            <h2 className="text-[36px] font-black uppercase leading-[1.05] tracking-tight mb-4">
              <Link href={`/issues/${latest.slug}`} className="text-ws-black hover:text-ws-accent no-underline">
                {nonBreakingDate(latest.title)}
              </Link>
            </h2>
            {latest.summary && (
              <p className="text-[19px] leading-[1.5] mb-6 max-w-2xl">{latest.summary}</p>
            )}
            <NeoPopButton href={`/issues/${latest.slug}`} variant="primary">
              Read this issue →
            </NeoPopButton>
          </NeoPopCard>
        </section>
      )}

      {/* Past issues */}
      {past.length > 0 && (
        <section aria-label="Past issues">
          <h2 className="text-[32px] font-black uppercase tracking-tight mb-6">Past issues</h2>
          <ul className="space-y-10 list-none p-0">
            {past.map(issue => (
              <li key={issue.id}>
                <NeoPopCard href={`/issues/${issue.slug}`} bg="white">
                  <div className="flex gap-3 text-[13px] font-bold uppercase tracking-wide mb-2">
                    <span>Issue {issue.issueNumber}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={issue.issueDate}>{formatDate(issue.issueDate)}</time>
                  </div>
                  <h3 className="text-[24px] font-black leading-tight mb-2 text-ws-black">
                    {nonBreakingDate(issue.title)}
                  </h3>
                  {issue.summary && (
                    <p className="text-[17px] leading-[1.5] text-ws-black">{issue.summary}</p>
                  )}
                </NeoPopCard>
              </li>
            ))}
          </ul>
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
