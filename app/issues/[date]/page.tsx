import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getIssueByDate,
  getIssueBlocks,
  getPublishedIssues,
  getAdjacentIssues,
  getRelatedIssues,
} from '@/lib/notion'
import { NotionRenderer } from '@/lib/notion-renderer'
import { MetadataStrip } from '@/components/MetadataStrip'
import { AIDisclosureBadge } from '@/components/AIDisclosureBadge'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton'
import { TableOfContents } from '@/components/TableOfContents'
import { ReadingProgress } from '@/components/ReadingProgress'
import { ArticleJsonLd } from '@/components/ArticleJsonLd'
import { IssueCard } from '@/components/IssueCard'
import { estimateReadingTime } from '@/lib/reading-time'
import { blocksToMarkdown } from '@/lib/to-markdown'

export const revalidate = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

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
  const [issue, adjacent, related] = await Promise.all([
    getIssueByDate(date),
    getAdjacentIssues(date),
    getRelatedIssues(date, 3),
  ])
  if (!issue) notFound()

  const blocks = await getIssueBlocks(issue.id)
  const readingTime = estimateReadingTime(blocks)
  const markdown = blocksToMarkdown(issue.title, blocks)

  // Extract h2 headings for table of contents
  const tocEntries = blocks
    .filter(b => b.type === 'heading_2' && b.headingId && b.content)
    .map(b => ({ id: b.headingId!, label: b.content }))

  return (
    <>
      <ArticleJsonLd issue={issue} baseUrl={BASE_URL} />
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

          <h1 className="text-[48px] font-bold text-govuk-black dark:text-white leading-tight mb-6 mt-2">
            {issue.title}
          </h1>

          {/* Share row */}
          <div className="flex flex-wrap gap-3 mb-8">
            <CopyLinkButton />
            <CopyMarkdownButton markdown={markdown} />
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

          {/* Related issues */}
          {related.length > 0 && (
            <section aria-label="More issues" className="mt-16">
              <h2 className="text-[22px] font-bold text-govuk-black dark:text-white mb-6">More issues</h2>
              <ul className="space-y-8 list-none p-0">
                {related.map(other => (
                  <li key={other.id}>
                    <IssueCard issue={other} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        {/* Sticky table of contents (xl screens only, hidden when < 3 headings) */}
        <TableOfContents entries={tocEntries} />
      </div>
    </>
  )
}
