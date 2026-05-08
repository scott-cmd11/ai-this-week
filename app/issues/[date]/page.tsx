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
import { issueDisplayTitle, nonBreakingDate } from '@/lib/title'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton'
import { TableOfContents } from '@/components/TableOfContents'
import { MobileToc } from '@/components/MobileToc'
import { ArticleJsonLd } from '@/components/ArticleJsonLd'
import { IssueCard } from '@/components/IssueCard'
import { SignalLedger } from '@/components/SignalLedger'
import { estimateReadingTime } from '@/lib/reading-time'
import { blocksToMarkdown } from '@/lib/to-markdown'
import { publicIssueBlocks } from '@/lib/issue-block-filter'
import { SITE_URL } from '@/lib/site'

export const revalidate = 300

interface Props {
  params: Promise<{ date: string }>
}

export async function generateStaticParams() {
  if (!process.env.NOTION_TOKEN) return []
  const issues = await getPublishedIssues()
  return issues.map(issue => ({ date: issue.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params
  const issue = await getIssueByDate(date)
  if (!issue) return {}
  const title = `${issueDisplayTitle(issue.title)} | AI Today`
  return {
    title: {
      absolute: title,
    },
    description: issue.summary,
    alternates: {
      canonical: `/issues/${issue.slug}`,
    },
    openGraph: {
      type: 'article',
      url: `/issues/${issue.slug}`,
      title,
      description: issue.summary,
      publishedTime: new Date(issue.issueDate + 'T12:00:00Z').toISOString(),
      images: [`/issues/${issue.slug}/opengraph-image`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: issue.summary,
      images: [`/issues/${issue.slug}/opengraph-image`],
    },
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

  const blocks = publicIssueBlocks(await getIssueBlocks(issue.id))
  const readingTime = estimateReadingTime(blocks)
  const markdown = blocksToMarkdown(issue.title, blocks)
  const issueStats = getIssueStats(blocks)
  const visibleIssueTitle = issueDisplayTitle(issue.title)

  const tocEntries = blocks
    .filter(b => b.type === 'heading_2' && b.headingId && b.content)
    .map(b => ({ id: b.headingId!, label: b.content }))
    .filter((entry, index, entries) =>
      entries.findIndex(candidate => candidate.label === entry.label) === index
    )

  return (
    <>
      <ArticleJsonLd issue={issue} baseUrl={SITE_URL} />

      <div className="xl:flex xl:gap-12 xl:items-start">
        <article aria-label={visibleIssueTitle} className="min-w-0 flex-1">
          <header className="mb-14 border-t border-ws-black pt-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <p className="type-meta text-ws-accent">
                Briefing file
              </p>
              <p className="type-meta text-ws-muted">
                Source-linked Canadian AI coverage.
              </p>
            </div>

            <h1 className="mb-8 max-w-6xl font-[family-name:var(--font-display)] text-[clamp(2.7rem,12vw,5.1rem)] font-medium leading-[0.98] tracking-normal text-ws-black [overflow-wrap:anywhere] sm:text-[clamp(4rem,9vw,8.5rem)] sm:leading-[0.9] sm:tracking-[-0.02em] sm:[overflow-wrap:normal]">
              {nonBreakingDate(visibleIssueTitle)}
            </h1>

            <SignalLedger
              items={[
                { label: 'Issue', value: `Issue ${String(issue.issueNumber).padStart(2, '0')}` },
                { label: 'Reading time', value: `${readingTime} min read` },
                {
                  label: 'File contents',
                  value: `${issueStats.stories} stories / ${issueStats.sections} sections`,
                },
              ]}
            />

            <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
              <div>
                {issue.summary && (
                  <p className="max-w-4xl text-[20px] leading-[1.55] text-ws-muted sm:text-[24px]">
                    {issue.summary}
                  </p>
                )}
                {issue.aiAssisted && (
                  <p className="type-meta mt-5 text-ws-muted">
                    Summaries are AI-assisted, editor-reviewed, and linked to original sources.
                  </p>
                )}
              </div>

              <IssueSignalBoard
                stories={issueStats.stories}
                sources={issueStats.sources}
                sections={issueStats.sections}
              />
            </div>
          </header>

          <MobileToc entries={tocEntries} />

          <NotionRenderer blocks={blocks} />

          <footer className="mt-14 border-t border-ws-black/70 pt-6">
            <div className="grid gap-4 border-b border-ws-border pb-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="type-meta text-ws-accent">Issue tools</p>
                <p className="mt-2 max-w-xl text-[14px] leading-[1.5] text-ws-muted">
                  Save, cite, or share this edition.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <CopyLinkButton />
                <CopyMarkdownButton markdown={markdown} />
              </div>
            </div>

            <nav
              aria-label="Issue navigation"
              className="grid grid-cols-1 gap-4 border-b border-ws-border py-6 sm:grid-cols-2"
            >
              {adjacent.prev ? (
                <IssueNavLink label="Previous issue" issue={adjacent.prev} />
              ) : <span />}
              {adjacent.next ? (
                <IssueNavLink label="Next issue" issue={adjacent.next} align="right" />
              ) : <span />}
            </nav>

            {related.length > 0 && (
              <section aria-label="More issues" className="py-6">
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <h2 className="type-meta text-ws-accent">More from the archive</h2>
                  <Link href="/issues" className="type-meta text-ws-muted hover:text-ws-accent">
                    All issues
                  </Link>
                </div>
                <ul className="m-0 grid list-none gap-0 divide-y divide-ws-border border-y border-ws-border p-0">
                  {related.map(other => (
                    <li key={other.id}>
                      <IssueCard issue={other} compact />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </footer>
        </article>

        <TableOfContents entries={tocEntries} />
      </div>
    </>
  )
}

function IssueNavLink({
  label,
  issue,
  align = 'left',
}: {
  label: string
  issue: { slug: string; title: string; issueDate: string; issueNumber: number }
  align?: 'left' | 'right'
}) {
  return (
    <Link
      href={`/issues/${issue.slug}`}
      className={[
        'group block border border-transparent py-2 no-underline transition-colors hover:border-ws-border hover:bg-ws-white/50',
        align === 'right' ? 'sm:text-right' : '',
      ].join(' ')}
    >
      <span className="type-meta text-ws-muted group-hover:text-ws-accent">{label}</span>
      <span className="mt-2 block font-[family-name:var(--font-display)] text-[1.45rem] font-medium leading-tight text-ws-black group-hover:text-ws-accent">
        {nonBreakingDate(issueDisplayTitle(issue.title))}
      </span>
    </Link>
  )
}

function IssueSignalBoard({
  stories,
  sources,
  sections,
}: {
  stories: number
  sources: number
  sections: number
}) {
  const sourceFill = Math.min(100, Math.max(8, sources * 12))
  const storyFill = Math.min(100, Math.max(18, stories * 5))
  const sectionFill = Math.min(100, Math.max(24, sections * 16))

  return (
    <aside aria-label="Issue signal graphic" className="block">
      <div className="border-y border-ws-border py-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="type-meta text-ws-accent">Signal map</p>
            <p className="mt-2 text-[13px] leading-[1.45] text-ws-muted">
              Coverage breadth for this file.
            </p>
          </div>
          <p className="type-meta text-ws-muted">
            {sections} sections
          </p>
        </div>

        <div className="grid gap-3">
          <SignalBar label="Stories" value={stories} fill={storyFill} />
          <SignalBar label="Sources" value={sources} fill={sourceFill} />
          <SignalBar label="Sections" value={sections} fill={sectionFill} />
        </div>
      </div>
    </aside>
  )
}

function SignalBar({ label, value, fill }: { label: string; value: number; fill: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="type-meta text-ws-muted">{label}</span>
        <span className="type-meta text-ws-black">{value}</span>
      </div>
      <div className="h-1.5 bg-ws-border">
        <div className="h-full bg-ws-accent" style={{ width: `${fill}%` }} />
      </div>
    </div>
  )
}

function getIssueStats(blocks: Awaited<ReturnType<typeof getIssueBlocks>>) {
  const sectionLabels = new Set(
    blocks
      .filter(block => block.type === 'heading_2' && block.content)
      .map(block => block.content.trim())
  )

  return {
    stories: blocks.filter(block => block.type === 'heading_3').length,
    sources: blocks.filter(block =>
      block.type === 'bookmark' ||
      block.richText?.some(segment => Boolean(segment.href))
    ).length,
    sections: sectionLabels.size,
  }
}
