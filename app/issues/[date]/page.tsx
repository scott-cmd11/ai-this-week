import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getIssueByDate, getIssueBlocks, getPublishedIssues } from '@/lib/notion'
import { NotionRenderer } from '@/lib/notion-renderer'
import { MetadataStrip } from '@/components/MetadataStrip'
import { AIDisclosureBadge } from '@/components/AIDisclosureBadge'

export const revalidate = 300

interface Props {
  params: Promise<{ date: string }>
}

export async function generateStaticParams() {
  const issues = await getPublishedIssues()
  return issues.map(issue => ({ date: issue.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const issue = await getIssueByDate(date)
  if (!issue) return {}
  return {
    title: `${issue.title} | AI This Week`,
    description: issue.summary,
  }
}

export default async function IssuePage({ params }: Props) {
  const { date } = await params
  const issue = await getIssueByDate(date)
  if (!issue) notFound()

  const blocks = await getIssueBlocks(issue.id)

  return (
    <article aria-label={issue.title}>
      <MetadataStrip issueNumber={issue.issueNumber} issueDate={issue.issueDate} />
      {issue.aiAssisted && <AIDisclosureBadge />}
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-8 mt-2">
        {issue.title}
      </h1>
      <NotionRenderer blocks={blocks} />
    </article>
  )
}
