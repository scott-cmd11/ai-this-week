interface Props {
  issueNumber: number
  issueDate: string
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00Z')
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function MetadataStrip({ issueNumber, issueDate }: Props) {
  return (
    <div className="type-meta flex gap-3" aria-label="Issue details">
      <span>Issue {issueNumber}</span>
      <span aria-hidden="true">/</span>
      <time dateTime={issueDate}>{formatDate(issueDate)}</time>
    </div>
  )
}
