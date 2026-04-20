interface Props {
  issueNumber: number
  issueDate: string  // YYYY-MM-DD
}

function formatDate(isoDate: string): string {
  // Add T12:00:00Z to avoid timezone-shift issues with date-only strings
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function MetadataStrip({ issueNumber, issueDate }: Props) {
  return (
    <div className="flex gap-3 text-[13px] font-bold uppercase tracking-wide" aria-label="Issue details">
      <span>Issue {issueNumber}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={issueDate}>{formatDate(issueDate)}</time>
    </div>
  )
}
