import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getIssueByDate, getIssueBlocks, getPublishedIssues, getAdjacentIssues } from '@/lib/notion'
import { NotionRenderer } from '@/lib/notion-renderer'
import { MetadataStrip } from '@/components/MetadataStrip'
import { AIDisclosureBadge } from '@/components/AIDisclosureBadge'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { TableOfContents } from '@/components/TableOfContents'
import { ReadingProgress } from '@/components/ReadingProgress'
import { estimateReadingTime } from '@/lib/reading-time'

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
  const [issue, adjacent] = await Promise.all([
    getIssueByDate(date),
    getAdjacentIssues(date),
  ])
  if (!issue) notFound()

  const blocks = await getIssueBlocks(issue.id)
  const readingTime = estimateReadingTime(blocks)

  // Extract h2 headings for table of contents
  const tocEntries = blocks
    .filter(b => b.type === 'heading_2' && b.headingId && b.content)
    .map(b => ({ id: b.headingId!, label: b.content }))

  return (
    <>
      <ReadingProgress />
      {/* Two-column layout: article + sticky TOC on wide screens */}
      <div className="xl:flex xl:gap-16 xl:items-start">
        <article aria-label={issue.title} className="min-w-0 flex-1">
          {/* Metadata + reading time */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[16px] text-govuk-dark-grey">
            <MetadataStrip issueNumber={issue.issueNumber} issueDate={issue.issueDate} />
            <span aria-label={`Estimated reading time: ${readingTime} minutes`}>
              · {readingTime} min read
            </span>
          </div>

          {issue.aiAssisted && <AIDisclosureBadge />}

          <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-6 mt-2">
            {issue.title}
          </h1>

          {/* Share */}
          <div className="mb-8">
            <CopyLinkButton />
          </div>

          <NotionRenderer blocks={blocks} />

          {/* Prev / Next navigation */}
          <nav
            aria-label="Issue navigation"
            className="border-t border-govuk-mid-grey mt-12 pt-8 grid grid-cols-2 gap-4"
          >
            <div>
              {adjacent.prev && (
                <>
                  <p className="text-[14px] text-govuk-dark-grey mb-1">← Older</p>
                  <Link
                    href={`/issues/${adjacent.prev.slug}`}
                    className="text-govuk-blue text-[17px] font-bold underline hover:text-govuk-black"
                  >
                    {adjacent.prev.title}
                  </Link>
                </>
              )}
            </div>
            <div className="text-right">
              {adjacent.next && (
                <>
                  <p className="text-[14px] text-govuk-dark-grey mb-1">Newer →</p>
                  <Link
                    href={`/issues/${adjacent.next.slug}`}
                    className="text-govuk-blue text-[17px] font-bold underline hover:text-govuk-black"
                  >
                    {adjacent.next.title}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </article>

        {/* Sticky table of contents (xl screens only, hidden when < 3 headings) */}
        <TableOfContents entries={tocEntries} />
      </div>
    </>
  )
}
