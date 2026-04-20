import Link from 'next/link'
import type { Issue } from '@/lib/types'

interface Props {
  issue: Issue
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function IssueCard({ issue }: Props) {
  return (
    <div className="border-b border-govuk-mid-grey pb-6">
      <div className="flex gap-3 text-[16px] text-govuk-dark-grey mb-1">
        <span>Issue {issue.issueNumber}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={issue.issueDate}>{formatDate(issue.issueDate)}</time>
      </div>
      <h2 className="text-[24px] font-bold text-govuk-black dark:text-white mb-2 leading-tight">
        <Link
          href={`/issues/${issue.slug}`}
          className="text-govuk-blue underline hover:text-govuk-black"
        >
          {issue.title}
        </Link>
      </h2>
      {issue.summary && (
        <p className="text-[19px] text-govuk-black dark:text-white leading-[1.5] m-0">{issue.summary}</p>
      )}
    </div>
  )
}
