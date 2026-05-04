import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/notion'
import { IssueSearch } from '@/components/IssueSearch'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'All Issues | AI Today',
  description: 'Browse every edition of AI Today.',
}

export default async function IssuesPage() {
  const issues = await getPublishedIssues()

  return (
    <>
      <p className="type-kicker mb-5">Archive</p>
      <h1 className="type-page-title mb-4">
        All Issues
      </h1>
      <div className="section-rule mb-10" aria-hidden="true" />
      <IssueSearch issues={issues} />
    </>
  )
}
