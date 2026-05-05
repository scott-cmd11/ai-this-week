import type { Issue } from '@/lib/types'
import { issueDisplayTitle, nonBreakingDate } from '@/lib/title'
import Link from 'next/link'

interface Props {
  issue: Issue
  compact?: boolean
}

export function IssueCard({ issue, compact = false }: Props) {
  return (
    <Link
      href={`/issues/${issue.slug}`}
      className={compact
        ? 'block py-4 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2'
        : 'block py-5 no-underline transition-colors hover:bg-ws-white/60 focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2'}
    >
      <div className="type-meta mb-3 flex gap-3 text-ws-accent">
        <span>Issue {issue.issueNumber}</span>
      </div>
      <h2 className={[
        'font-[family-name:var(--font-display)] font-medium leading-tight text-ws-black',
        compact ? 'mb-2 text-[1.45rem]' : 'mb-3 text-[2rem]',
      ].join(' ')}>
        {nonBreakingDate(issueDisplayTitle(issue.title))}
      </h2>
      {issue.summary && (
        <p className={compact ? 'type-body m-0 text-[14px]' : 'type-body m-0 text-[16px]'}>
          {issue.summary}
        </p>
      )}
    </Link>
  )
}
