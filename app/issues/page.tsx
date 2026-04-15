import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/notion'
import { IssueCard } from '@/components/IssueCard'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'All Issues | AI This Week',
  description: 'Browse every edition of AI This Week.',
}

export default async function IssuesPage() {
  const issues = await getPublishedIssues()

  return (
    <>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-10">
        All Issues
      </h1>
      {issues.length === 0 ? (
        <p className="text-[19px] text-govuk-black">No issues published yet.</p>
      ) : (
        <ul className="space-y-8 list-none p-0" aria-label="All newsletter issues">
          {issues.map(issue => (
            <li key={issue.id}>
              <IssueCard issue={issue} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
