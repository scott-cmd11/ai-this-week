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
import { nonBreakingDate } from '@/lib/title'
import { MetadataStrip } from '@/components/MetadataStrip'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { CopyMarkdownButton } from '@/components/CopyMarkdownButton'
import { TableOfContents } from '@/components/TableOfContents'
import { MobileToc } from '@/components/MobileToc'
import { SectionProgress } from '@/components/SectionProgress'
import { ReadingProgress } from '@/components/ReadingProgress'
import { ArticleJsonLd } from '@/components/ArticleJsonLd'
import { IssueCard } from '@/components/IssueCard'
import { estimateReadingTime } from '@/lib/reading-time'
import { blocksToMarkdown } from '@/lib/to-markdown'

export const revalidate = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aitoday.vercel.app'

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
  return {
    title: `${issue.title} | AI Today`,
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
  const issueStats = getIssueStats(blocks)

  const tocEntries = blocks
    .filter(b => b.type === 'heading_2' && b.headingId && b.content)
    .map(b => ({ id: b.headingId!, label: b.content }))
    .filter((entry, index, entries) =>
      entries.findIndex(candidate => candidate.label === entry.label) === index
    )

  return (
    <>
      <ArticleJsonLd issue={issue} baseUrl={BASE_URL} />
      <ReadingProgress />
      <SectionProgress sections={tocEntries} />

      <div className="xl:flex xl:gap-12 xl:items-start">
        <article aria-label={issue.title} className="min-w-0 flex-1">
          <header className="mb-14 border-t border-ws-black pt-8">
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
              <div className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-ws-muted">
                <MetadataStrip issueNumber={issue.issueNumber} issueDate={issue.issueDate} />
                <span aria-label={`Estimated reading time: ${readingTime} minutes`}>
                  / {readingTime} min read
                </span>
              </div>
              <p className="type-meta text-ws-accent">
                AI Today briefing
              </p>
            </div>

            <h1 className="mb-8 max-w-6xl break-normal font-[family-name:var(--font-display)] text-[clamp(3rem,9vw,8.5rem)] font-medium leading-[0.94] tracking-[-0.035em] text-ws-black [overflow-wrap:normal] [word-break:normal] sm:leading-[0.9]">
              {nonBreakingDate(issue.title)}
            </h1>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
              <div>
                {issue.summary && (
                  <p className="max-w-4xl text-[20px] leading-[1.55] text-ws-muted sm:text-[24px]">
                    {issue.summary}
                  </p>
                )}
              </div>

              <IssueSignalBoard
                issueNumber={issue.issueNumber}
                stories={issueStats.stories}
                sources={issueStats.sources}
                sections={issueStats.sections}
              />
            </div>

            <div className="mt-10 border-t border-ws-black/75" aria-hidden="true" />

            <dl className="mt-0 grid border-b border-ws-border sm:grid-cols-4">
              <IssueStat label="Stories" value={issueStats.stories} />
              <IssueStat label="Sources" value={issueStats.sources} />
              <IssueStat label="Sections" value={issueStats.sections} />
              {issue.aiAssisted && (
                <p className="type-meta border-t border-ws-border py-4 text-ws-muted sm:border-l sm:border-t-0 sm:px-4">
                  Summaries are AI-assisted and source-linked.
                </p>
              )}
            </dl>
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

function IssueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2 border-t border-ws-border py-4 sm:border-l sm:px-4 sm:first:border-l-0">
      <dt className="type-meta text-ws-muted">{label}</dt>
      <dd className="text-[1.2rem] font-semibold leading-none text-ws-black tabular-nums">{value}</dd>
    </div>
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
        {nonBreakingDate(issue.title)}
      </span>
    </Link>
  )
}

function IssueSignalBoard({
  issueNumber,
  stories,
  sources,
  sections,
}: {
  issueNumber: number
  stories: number
  sources: number
  sections: number
}) {
  const sourceFill = Math.min(100, Math.max(8, sources * 12))
  const storyFill = Math.min(100, Math.max(18, stories * 5))
  const sectionFill = Math.min(100, Math.max(24, sections * 16))
  const cells = 48

  return (
    <aside aria-label="Issue signal graphic" className="block">
      <div className="relative overflow-hidden border border-ws-black/25 bg-[#fffaf4] p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-ws-black" aria-hidden="true" />
        <div className="flex items-start justify-between border-b border-ws-border pb-4">
          <div>
            <p className="type-meta text-ws-muted">Issue telemetry</p>
            <p className="mt-2 max-w-[14rem] text-[13px] leading-[1.45] text-ws-muted">
              Stories, sources, and section density.
            </p>
          </div>
          <p className="font-[family-name:var(--font-display)] text-[3.4rem] font-medium leading-none text-ws-accent/80 tabular-nums">
            {String(issueNumber).padStart(2, '0')}
          </p>
        </div>

        <div className="grid grid-cols-12 gap-1 py-5" aria-hidden="true">
          {Array.from({ length: cells }).map((_, index) => {
            const active =
              index % 11 === 0 ||
              index < sections * 5 ||
              index > cells - Math.max(6, stories)
            return (
              <span
                key={index}
                className={active ? 'h-2.5 bg-ws-accent/75' : 'h-2.5 bg-ws-border'}
              />
            )
          })}
        </div>

        <svg viewBox="0 0 300 84" className="mb-5 h-auto w-full text-ws-muted/45" aria-hidden="true">
          <path
            d="M2 64 C 42 20, 68 72, 112 38 S 197 20, 298 52"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M2 42 C 46 34, 83 16, 129 48 S 214 76, 298 24"
            fill="none"
            stroke="var(--color-ws-accent)"
            strokeOpacity="0.72"
            strokeWidth="1.4"
          />
          <circle cx="79" cy="27" r="3" fill="var(--color-ws-accent)" />
          <circle cx="218" cy="63" r="3" fill="currentColor" />
        </svg>

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
  return {
    stories: blocks.filter(block => block.type === 'heading_3').length,
    sources: blocks.filter(block =>
      block.type === 'bookmark' ||
      block.richText?.some(segment => Boolean(segment.href))
    ).length,
    sections: blocks.filter(block => block.type === 'heading_2').length,
  }
}
