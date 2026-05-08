import React from 'react'
import type { NotionBlock, RichTextSegment } from './types'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from './category-mapping'

interface Props {
  blocks: NotionBlock[]
}

interface ArticleGroup {
  kind: 'article'
  id: string
  title: string
  paragraphs: NotionBlock[]
  bookmarkUrl: string | null
  bookmarkLabel: string | null
  publishedDate: string | null
  imageUrl: string | null
  imageAlt: string
}

interface ListGroup {
  kind: 'list'
  items: NotionBlock[]
}

interface PassthroughBlock {
  kind: 'block'
  block: NotionBlock
}

interface SectionChunk {
  header: PassthroughBlock | null
  count: number
  articles: ArticleGroup[]
  trailingBlocks: (ListGroup | PassthroughBlock)[]
}

type RenderItem = ArticleGroup | ListGroup | PassthroughBlock

const EXTRA_SECTION_META: Record<string, { icon: string; tagline: string }> = {
  Upcoming: { icon: 'CAL', tagline: 'Webinars, courses, conferences, and meetups worth your time' },
}

export function NotionRenderer({ blocks }: Props) {
  const items = groupBlocks(blocks)
  const chunks = chunkBySections(items)

  return (
    <div className="notion-body">
      {chunks.map((chunk, ci) => (
        <React.Fragment key={ci}>
          {chunk.header && (
            <SectionHeader block={chunk.header.block} count={chunk.count} />
          )}
          {chunk.articles.length > 0 && (
            <SectionList articles={chunk.articles} />
          )}
          {chunk.trailingBlocks.map((item) => {
            if (item.kind === 'list') {
              return (
                <ul key={item.items[0].id} className="mb-5 list-disc space-y-2 pl-6">
                  {item.items.map(b => (
                    <li key={b.id} className="text-[17px] leading-[1.6] text-ws-black">
                      <RichText segments={b.richText} fallback={b.content} />
                    </li>
                  ))}
                </ul>
              )
            }
            return <Block key={item.block.id} block={item.block} />
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

function groupBlocks(blocks: NotionBlock[]): RenderItem[] {
  const out: RenderItem[] = []
  let article: ArticleGroup | null = null
  let list: NotionBlock[] = []

  const flushList = () => {
    if (list.length > 0) {
      out.push({ kind: 'list', items: list })
      list = []
    }
  }

  const flushArticle = () => {
    if (article) {
      out.push(article)
      article = null
    }
  }

  for (const block of blocks) {
    if (block.type === 'bulleted_list_item') {
      flushArticle()
      list.push(block)
      continue
    }
    flushList()

    if (block.type === 'heading_3') {
      flushArticle()
      article = {
        kind: 'article',
        id: block.id,
        title: block.content,
        paragraphs: [],
        bookmarkUrl: null,
        bookmarkLabel: null,
        publishedDate: null,
        imageUrl: null,
        imageAlt: '',
      }
      continue
    }

    if (article) {
      if (block.type === 'paragraph') {
        const linkedUrl = firstLinkedHref(block)
        if (linkedUrl && isSourceParagraph(block, linkedUrl)) {
          article.bookmarkUrl = linkedUrl
          article.bookmarkLabel = hostnameOf(linkedUrl)
          continue
        }
        if (block.content.startsWith('Published:')) {
          article.publishedDate = block.content.replace(/^Published:\s*/i, '').trim() || null
          continue
        }
        if (block.content) {
          article.paragraphs.push(block)
        }
        continue
      }
      if (block.type === 'bookmark' && block.href) {
        article.bookmarkUrl = block.href
        article.bookmarkLabel = block.content || block.href
        continue
      }
      if (block.type === 'image' && block.href) {
        article.imageUrl = block.href
        article.imageAlt = block.content !== block.href ? block.content : ''
        continue
      }
      if (block.type === 'divider') {
        flushArticle()
        continue
      }
      flushArticle()
    }

    out.push({ kind: 'block', block })
  }

  flushList()
  flushArticle()
  return out
}

function chunkBySections(items: RenderItem[]): SectionChunk[] {
  const chunks: SectionChunk[] = []
  const chunksByHeading = new Map<string, SectionChunk>()
  let current: SectionChunk = { header: null, count: 0, articles: [], trailingBlocks: [] }

  const pushCurrent = () => {
    if (current.header === null && current.articles.length === 0 && current.trailingBlocks.length === 0) return

    const heading = current.header?.block.content.trim()
    if (heading) {
      const existing = chunksByHeading.get(heading)
      if (existing) {
        existing.count += current.count
        existing.articles.push(...current.articles)
        existing.trailingBlocks.push(...current.trailingBlocks)
        return
      }
      chunksByHeading.set(heading, current)
    }

    chunks.push(current)
  }

  for (const item of items) {
    if (item.kind === 'block' && item.block.type === 'heading_2') {
      pushCurrent()
      current = { header: item as PassthroughBlock, count: 0, articles: [], trailingBlocks: [] }
      continue
    }
    if (item.kind === 'article') {
      current.articles.push(item)
      current.count++
      continue
    }
    current.trailingBlocks.push(item as ListGroup | PassthroughBlock)
  }

  pushCurrent()

  return mergeRepeatedSections(chunks)
}

function mergeRepeatedSections(chunks: SectionChunk[]): SectionChunk[] {
  const merged: SectionChunk[] = []
  const sectionIndex = new Map<string, SectionChunk>()

  for (const chunk of chunks) {
    const label = chunk.header?.block.content
    if (!label) {
      merged.push(chunk)
      continue
    }

    const existing = sectionIndex.get(label)
    if (!existing) {
      sectionIndex.set(label, chunk)
      merged.push(chunk)
      continue
    }

    existing.articles.push(...chunk.articles)
    existing.trailingBlocks.push(...chunk.trailingBlocks)
    existing.count = existing.articles.length
  }

  return merged
}

function SectionHeader({ block, count }: { block: NotionBlock; count: number }) {
  const label = block.content
  const meta = (CATEGORY_ORDER as readonly string[]).includes(label)
    ? CATEGORY_META[label as Category]
    : EXTRA_SECTION_META[label] ?? null
  const compact = count > 0 && count <= 2

  return (
    <header
      id={block.headingId}
      className={compact
        ? 'mt-10 scroll-mt-24 border-t border-ws-black/80 pt-4'
        : 'mt-16 scroll-mt-24 border-t border-ws-black pt-6'}
    >
      <div className={compact
        ? 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'
        : 'grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)_10rem] md:items-end'}
      >
        {!compact && <p className="type-meta text-ws-accent">Section</p>}
        <div>
          <h2 className={[
            'm-0 font-[family-name:var(--font-display)] font-medium tracking-[-0.025em] text-ws-black',
            compact
              ? 'text-[clamp(2rem,4vw,3rem)] leading-[0.98]'
              : 'text-[clamp(2.5rem,5vw,5rem)] leading-[0.88]',
          ].join(' ')}>
            {label}
          </h2>
          {meta?.tagline && (
            <p className={compact
              ? 'mt-2 max-w-2xl text-[14px] leading-[1.45] text-ws-muted'
              : 'mt-3 max-w-2xl text-[15px] leading-[1.5] text-ws-muted'}
            >
              {meta.tagline}
            </p>
          )}
        </div>
        <div className={compact ? 'flex items-center gap-3 sm:justify-end' : 'grid gap-3'}>
          <div className="type-meta flex items-center gap-2 text-ws-muted sm:justify-end md:justify-end">
            {meta && (
              <span aria-hidden="true" className="text-ws-accent">
                {meta.icon}
              </span>
            )}
            {count > 0 && (
              <span>
                {count} {count === 1 ? 'story' : 'stories'}
              </span>
            )}
          </div>
          <div className={compact ? 'hidden grid-cols-8 gap-1 sm:grid' : 'grid grid-cols-8 gap-1'} aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={index}
                className={[
                  index < Math.max(3, count * 2) ? 'bg-ws-accent/70' : 'bg-ws-border',
                  compact ? 'h-1 w-3' : 'h-1.5',
                ].join(' ')}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

function SectionList({ articles }: { articles: ArticleGroup[] }) {
  return (
    <ol className="mt-8 mb-16 grid list-none divide-y divide-ws-border border-y border-ws-border p-0">
      {articles.map((article, index) => (
        <li key={article.id}>
          <ArticleRow article={article} numberInSection={index + 1} />
        </li>
      ))}
    </ol>
  )
}

function ArticleRow({
  article,
  numberInSection,
}: {
  article: ArticleGroup
  numberInSection: number
}) {
  const { title, paragraphs, bookmarkUrl, imageUrl, imageAlt, publishedDate } = article
  const sourceLabel = bookmarkUrl ? hostnameOf(bookmarkUrl) : article.bookmarkLabel ?? 'Source link needed'
  const summary = paragraphs
    .map(paragraph => paragraph.content.trim())
    .filter(Boolean)
    .join('\n\n')

  return (
    <article className="group grid gap-5 py-8 transition-colors duration-200 sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-[4rem_minmax(0,1fr)_12rem]">
      <div className="font-[family-name:var(--font-display)] text-[2.35rem] font-medium leading-none text-ws-accent/70 tabular-nums transition-colors group-hover:text-ws-accent">
        {String(numberInSection).padStart(2, '0')}
      </div>

      <div className="min-w-0">
        <StoryMeta sourceLabel={sourceLabel} publishedDate={publishedDate} />
        <h3 className="mt-2 max-w-4xl font-[family-name:var(--font-display)] text-[clamp(1.85rem,3.5vw,3.25rem)] font-medium leading-[0.98] tracking-[-0.018em] text-ws-black">
          <StoryTitle href={bookmarkUrl ?? undefined} title={title} />
        </h3>
        {summary && <AISummary text={summary} />}
        <SourceAction href={bookmarkUrl ?? undefined} sourceLabel={sourceLabel} />
      </div>

      {imageUrl ? (
        <figure className="sm:col-start-2 lg:col-start-auto lg:pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt || title}
            className="aspect-[4/3] w-full object-cover"
            loading="lazy"
          />
        </figure>
      ) : (
        <StorySignal numberInSection={numberInSection} sourceLabel={sourceLabel} />
      )}
    </article>
  )
}

function StorySignal({
  numberInSection,
  sourceLabel,
}: {
  numberInSection: number
  sourceLabel: string
}) {
  const seed = sourceLabel.length + numberInSection

  return (
    <div className="sm:col-start-2 lg:col-start-auto lg:pt-8" aria-hidden="true">
      <div className="border-t border-ws-border pt-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="type-meta text-ws-muted">Story trace</p>
          <div className="grid w-28 grid-cols-7 gap-1">
            {Array.from({ length: 14 }).map((_, index) => {
              const active = (index + seed) % 4 === 0 || index === numberInSection % 14
              return (
                <span
                  key={index}
                  className={active ? 'h-1.5 bg-ws-accent/75' : 'h-1.5 bg-ws-border'}
                />
              )
            })}
          </div>
        </div>
        <div className="mb-4 hidden grid-cols-5 gap-1 lg:grid">
          {Array.from({ length: 15 }).map((_, index) => {
            const active = (index + seed) % 4 === 0 || index === numberInSection % 15
            return (
              <span
                key={index}
                className={active ? 'h-1.5 bg-ws-accent/75' : 'h-1.5 bg-ws-border'}
              />
            )
          })}
        </div>
        <svg viewBox="0 0 144 64" className="h-auto w-full text-ws-muted/50" role="img">
          <path
            d={`M2 ${50 - (seed % 12)} C 22 ${16 + (seed % 10)}, 36 ${56 - (seed % 20)}, 55 ${30 + (seed % 9)} S 94 ${16 + (seed % 14)}, 142 ${34 + (seed % 18)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d={`M2 ${40 + (seed % 10)} C 31 ${25 - (seed % 6)}, 44 ${48 + (seed % 8)}, 70 ${25 + (seed % 16)} S 109 ${54 - (seed % 18)}, 142 ${20 + (seed % 22)}`}
            fill="none"
            stroke="var(--color-ws-accent)"
            strokeOpacity="0.72"
            strokeWidth="1.4"
          />
          <circle cx="32" cy={24 + (seed % 20)} r="2.5" fill="var(--color-ws-accent)" opacity="0.78" />
          <circle cx="96" cy={42 - (seed % 14)} r="2.5" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}

function StoryTitle({ href, title }: { href?: string; title: string }) {
  if (!href) return <>{title}</>

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ws-black no-underline hover:text-ws-accent focus-visible:text-ws-accent"
    >
      {title}
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  )
}

function StoryMeta({
  sourceLabel,
  publishedDate,
}: {
  sourceLabel: string
  publishedDate: string | null
}) {
  return (
    <p className="type-meta flex flex-wrap items-center gap-2 text-ws-muted">
      <span className="truncate">{sourceLabel}</span>
      {publishedDate && (
        <>
          <span aria-hidden="true" className="text-ws-border">/</span>
          <span>Published {publishedDate}</span>
        </>
      )}
    </p>
  )
}

function AISummary({ text }: { text: string }) {
  return (
    <div className="mt-5 max-w-3xl space-y-3 text-[17px] leading-[1.68] text-ws-muted">
      {text.split('\n\n').map(paragraph => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  )
}

function SourceAction({ href, sourceLabel }: { href?: string; sourceLabel: string }) {
  if (!href) {
    return (
      <p className="type-meta mt-5 text-ws-muted/70">
        Source link needed
      </p>
    )
  }

  return (
    <p className="mt-5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="type-button inline-flex items-baseline gap-1.5 border-b border-ws-accent pb-1 text-ws-accent no-underline transition-colors hover:text-ws-accent-hover"
      >
        <span>Read on</span>
        <span className="text-ws-black">{compactUrlLabel(sourceLabel)}</span>
        <span className="sr-only"> (opens in new tab)</span>
      </a>
    </p>
  )
}

function RichText({ segments, fallback }: { segments?: RichTextSegment[]; fallback: string }) {
  if (!segments || segments.length === 0) return <>{fallback}</>

  return (
    <>
      {segments.map((seg, i) => {
        const inner = seg.bold ? <strong>{seg.text}</strong> : seg.text
        if (seg.href) {
          return (
            <a
              key={i}
              href={seg.href}
              className="text-ws-accent underline underline-offset-2 decoration-ws-accent/40 hover:decoration-ws-accent focus:outline-none focus:bg-ws-accent-light"
              target="_blank"
              rel="noopener noreferrer"
            >
              {inner}
              <span className="sr-only"> (opens in new tab)</span>
            </a>
          )
        }
        return <React.Fragment key={i}>{inner}</React.Fragment>
      })}
    </>
  )
}

function Block({ block }: { block: NotionBlock }) {
  switch (block.type) {
    case 'heading_2':
      return (
        <h2
          id={block.headingId}
          className="mt-12 mb-6 font-[family-name:var(--font-display)] text-[2rem] font-medium leading-tight text-ws-black"
        >
          {block.content}
        </h2>
      )
    case 'heading_3':
      return (
        <h3 className="mt-6 mb-3 font-[family-name:var(--font-display)] text-[1.55rem] font-medium leading-tight text-ws-black">
          {block.content}
        </h3>
      )
    case 'paragraph':
      return block.content ? (
        <p className="mb-4 text-[17px] leading-[1.6] text-ws-black">
          <RichText segments={block.richText} fallback={block.content} />
        </p>
      ) : null
    case 'image':
      if (!block.href) return null
      return (
        <figure className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.href}
            alt={block.content !== block.href ? block.content : 'Issue image'}
            className="w-full max-w-2xl rounded-[0.35rem]"
            loading="lazy"
          />
          {block.content && block.content !== block.href && (
            <figcaption className="type-meta mt-2">{block.content}</figcaption>
          )}
        </figure>
      )
    case 'bookmark':
      if (!block.href) return null
      return (
        <p className="mb-4 text-[15px] text-ws-muted">
          <a
            href={block.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ws-muted underline underline-offset-2 decoration-ws-muted/40 hover:text-ws-accent hover:decoration-ws-accent"
          >
            {block.content || hostnameOf(block.href)}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </p>
      )
    case 'divider':
      return <hr className="my-10 border-t border-ws-border" aria-hidden="true" />
    default:
      return null
  }
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function firstLinkedHref(block: NotionBlock): string | null {
  return block.richText?.find(seg => seg.href)?.href ?? null
}

function isSourceParagraph(block: NotionBlock, href: string): boolean {
  const text = block.content.trim()
  if (!text) return false
  return text === href || /^https?:\/\//i.test(text)
}

function compactUrlLabel(label: string): string {
  return label.length > 18 ? `${label.slice(0, 18)}...` : label
}
