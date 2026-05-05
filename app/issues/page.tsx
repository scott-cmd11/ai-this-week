import type { Metadata } from 'next'
import { getPublishedIssues } from '@/lib/notion'
import { IssueSearch } from '@/components/IssueSearch'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Issue Archive | AI Today',
  description: 'Browse the AI Today issue archive.',
}

export default async function IssuesPage() {
  const issues = await getPublishedIssues()

  return (
    <>
      <p className="type-kicker mb-5">Issue archive</p>
      <h1 className="type-page-title mb-4">
        Previous briefings
      </h1>
      <p className="type-lede mb-8 max-w-3xl">
        A chronological record of published editions. Each issue is source-linked and written for quick professional reading.
      </p>
      <div className="section-rule mb-10" aria-hidden="true" />
      <IssueSearch issues={issues} />
    </>
  )
}
