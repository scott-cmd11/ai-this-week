import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/notion'
import { IssueSearch } from '@/components/IssueSearch'

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
      <IssueSearch issues={issues} />
    </>
  )
}
