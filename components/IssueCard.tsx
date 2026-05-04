import type { Issue } from '@/lib/types'
import { nonBreakingDate } from '@/lib/title'
import Link from 'next/link'

interface Props {
  issue: Issue
  compact?: boolean
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function IssueCard({ issue, compact = false }: Props) {
  return (
    <Link
      href={`/issues/${issue.slug}`}
      className={compact
        ? 'block py-4 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2'
        : 'block border-y border-ws-border py-5 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2'}
    >
      <div className="type-meta mb-3 flex gap-3">
        <span>Issue {issue.issueNumber}</span>
        <span aria-hidden="true">/</span>
        <time dateTime={issue.issueDate}>{formatDate(issue.issueDate)}</time>
      </div>
      <h2 className={[
        'font-[family-name:var(--font-display)] font-medium leading-tight text-ws-black',
        compact ? 'mb-2 text-[1.45rem]' : 'mb-3 text-[2rem]',
      ].join(' ')}>
        {nonBreakingDate(issue.title)}
      </h2>
      {issue.summary && (
        <p className={compact ? 'type-body m-0 text-[14px]' : 'type-body m-0 text-[16px]'}>
          {issue.summary}
        </p>
      )}
    </Link>
  )
}
