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
      <h1 className="text-[48px] sm:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        All Issues
      </h1>
      <div className="w-20 h-[6px] bg-neopop-red mb-10" aria-hidden="true" />
      <IssueSearch issues={issues} />
    </>
  )
}
