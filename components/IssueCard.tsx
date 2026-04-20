import type { Issue } from '@/lib/types'
import { NeoPopCard } from './NeoPop/NeoPopCard'

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
    <NeoPopCard href={`/issues/${issue.slug}`} bg="white">
      <div className="flex gap-3 text-[13px] font-bold uppercase tracking-wide mb-2">
        <span>Issue {issue.issueNumber}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={issue.issueDate}>{formatDate(issue.issueDate)}</time>
      </div>
      <h2 className="text-[24px] font-black leading-tight mb-2 text-neopop-black">
        {issue.title}
      </h2>
      {issue.summary && (
        <p className="text-[17px] leading-[1.5] text-neopop-black m-0">{issue.summary}</p>
      )}
    </NeoPopCard>
  )
}
