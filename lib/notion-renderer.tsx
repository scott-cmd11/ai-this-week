import React from 'react'
import type { NotionBlock, RichTextSegment } from './types'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from './category-mapping'

interface Props {
  blocks: NotionBlock[]
}

// ─── Public API ─────────────────────────────────────────────────────────────────

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
            <SectionGrid articles={chunk.articles} />
          )}
          {chunk.trailingBlocks.map((item) => {
            if (item.kind === 'list') {
              return (
                <ul key={item.items[0].id} className="list-disc pl-6 mb-4 space-y-2">
                  {item.items.map(b => (
                    <li key={b.id} className="text-[19px] text-ws-black leading-[1.5]">
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

// ─── Article grouping ───────────────────────────────────────────────────────────

interface ArticleGroup {
  kind: 'article'
  id: string
  title: string
  paragraphs: NotionBlock[]
  bookmarkUrl: string | null
  bookmarkLabel: string | null
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

type RenderItem = ArticleGroup | ListGroup | PassthroughBlock

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
        imageUrl: null,
        imageAlt: '',
      }
      continue
    }

    if (article) {
      if (block.type === 'paragraph') {
        if (block.content && !block.content.startsWith('Published:')) {
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

// ─── Section chunking ───────────────────────────────────────────────────────────

interface SectionChunk {
  header: PassthroughBlock | null
  count: number
  articles: ArticleGroup[]
  trailingBlocks: (ListGroup | PassthroughBlock)[]
}

function chunkBySections(items: RenderItem[]): SectionChunk[] {
  const chunks: SectionChunk[] = []
  let current: SectionChunk = { header: null, count: 0, articles: [], trailingBlocks: [] }

  for (const item of items) {
    if (item.kind === 'block' && item.block.type === 'heading_2') {
      // Close the current chunk and start a new one
      if (current.header !== null || current.articles.length > 0 || current.trailingBlocks.length > 0) {
        chunks.push(current)
      }
      current = { header: item as PassthroughBlock, count: 0, articles: [], trailingBlocks: [] }
      continue
    }
    if (item.kind === 'article') {
      current.articles.push(item)
      current.count++
      continue
    }
    // Lists and other passthrough blocks
    current.trailingBlocks.push(item as ListGroup | PassthroughBlock)
  }

  // Push the last chunk
  if (current.header !== null || current.articles.length > 0 || current.trailingBlocks.length > 0) {
    chunks.push(current)
  }

  return chunks
}

// ─── Section header — bold black editorial band ─────────────────────────────────

function SectionHeader({ block, count }: { block: NotionBlock; count: number }) {
  const label = block.content
  const meta = (CATEGORY_ORDER as readonly string[]).includes(label)
    ? CATEGORY_META[label as Category]
    : EXTRA_SECTION_META[label] ?? null

  return (
    <header
      id={block.headingId}
      className="mt-16 mb-0 -mx-4 sm:mx-0 bg-ws-black text-ws-white px-5 sm:px-6 py-5 sm:py-6 scroll-mt-20"
    >
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-ws-accent mb-2">
        Section
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h2 className="text-[28px] sm:text-[40px] font-black uppercase tracking-tight leading-[1] text-ws-white m-0">
          {label}
        </h2>
        {meta && (
          <span aria-hidden="true" className="text-[18px] leading-none ml-1">
            {meta.icon}
          </span>
        )}
      </div>
      {count > 0 && (
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white/50 mt-2">
          {count} {count === 1 ? 'story' : 'stories'}
        </p>
      )}
      {meta?.tagline && (
        <p className="text-[13px] text-white/60 mt-1.5">{meta.tagline}</p>
      )}
    </header>
  )
}

const EXTRA_SECTION_META: Record<string, { icon: string; tagline: string }> = {
  Upcoming: { icon: '📅', tagline: 'Webinars, courses, conferences, and meetups worth your time' },
}

// ─── Section grid — card grid wrapper ──────────────────────────────────────────

function SectionGrid({ articles }: { articles: ArticleGroup[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 mb-16">
      {articles.map((article, index) => (
        <div key={article.id} className={index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}>
          <ArticleCard article={article} isHero={index === 0} numberInSection={index + 1} />
        </div>
      ))}
    </div>
  )
}

// ─── Article card ───────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  isHero,
  numberInSection,
}: {
  article: ArticleGroup
  isHero: boolean
  numberInSection: number
}) {
  const { title, paragraphs, bookmarkUrl, imageUrl, imageAlt } = article
  const host = bookmarkUrl ? hostnameOf(bookmarkUrl) : null
  const excerpt = paragraphs[0]?.content ?? ''

  return (
    <article className="h-full flex flex-col border-[2px] border-ws-black bg-ws-white hover:bg-ws-accent-light transition-colors duration-150">
      {/* Image / no-image fill */}
      {isHero ? (
        <div className="flex flex-col sm:flex-row flex-1">
          <div className="sm:w-[45%] shrink-0 overflow-hidden bg-ws-border">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={imageAlt}
                className="w-full h-full object-cover aspect-[4/3] sm:aspect-auto"
                loading="lazy"
              />
            ) : (
              <div className="bg-ws-accent-light flex items-end p-5 aspect-[4/3] sm:h-full select-none overflow-hidden">
                <span aria-hidden="true" className="text-[100px] font-black leading-none text-ws-black/10 tabular-nums">
                  {String(numberInSection).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 p-5 justify-between">
            <div>
              <h3 className="text-[20px] sm:text-[24px] font-black leading-tight font-serif-body mb-3">
                {bookmarkUrl ? (
                  <a
                    href={bookmarkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ws-black no-underline hover:text-ws-accent focus-visible:text-ws-accent"
                  >
                    {title}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                ) : title}
              </h3>
              {excerpt && (
                <p className="text-[15px] text-ws-muted leading-[1.55] font-serif-body line-clamp-4">
                  {excerpt}
                </p>
              )}
            </div>
            {host && bookmarkUrl && (
              <p className="mt-4 pt-3 border-t border-ws-border text-[11px] font-black uppercase tracking-[0.1em] text-ws-muted">
                <a
                  href={bookmarkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ws-accent"
                >
                  {host} →
                </a>
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-hidden bg-ws-border">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={imageAlt}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
            ) : (
              <div className="bg-ws-accent-light flex items-end p-4 aspect-video select-none overflow-hidden">
                <span aria-hidden="true" className="text-[80px] font-black leading-none text-ws-black/10 tabular-nums">
                  {String(numberInSection).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 p-4">
            <h3 className="text-[17px] sm:text-[19px] font-black leading-tight font-serif-body mb-2">
              {bookmarkUrl ? (
                <a
                  href={bookmarkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ws-black no-underline hover:text-ws-accent focus-visible:text-ws-accent"
                >
                  {title}
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              ) : title}
            </h3>
            {excerpt && (
              <p className="text-[14px] text-ws-muted leading-[1.5] font-serif-body line-clamp-3 flex-1">
                {excerpt}
              </p>
            )}
            {host && bookmarkUrl && (
              <p className="mt-auto pt-3 border-t border-ws-border text-[11px] font-black uppercase tracking-[0.1em] text-ws-muted">
                <a
                  href={bookmarkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ws-accent"
                >
                  {host} →
                </a>
              </p>
            )}
          </div>
        </>
      )}
    </article>
  )
}

// ─── Rich text ──────────────────────────────────────────────────────────────────

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

// ─── Passthrough block rendering ────────────────────────────────────────────────

function Block({ block }: { block: NotionBlock }) {
  switch (block.type) {
    case 'heading_2':
      return (
        <h2
          id={block.headingId}
          className="text-[28px] font-black uppercase tracking-tight text-ws-black mt-12 mb-6 leading-tight"
        >
          {block.content}
        </h2>
      )
    case 'heading_3':
      return (
        <h3 className="text-[22px] font-bold text-ws-black mt-6 mb-3 leading-tight font-serif-body">
          {block.content}
        </h3>
      )
    case 'paragraph':
      return block.content ? (
        <p className="text-[19px] text-ws-black leading-[1.5] mb-4">
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
            alt={block.content !== block.href ? block.content : ''}
            className="w-full max-w-2xl"
            loading="lazy"
          />
          {block.content && block.content !== block.href && (
            <figcaption className="text-[14px] font-bold uppercase tracking-wide mt-2">
              {block.content}
            </figcaption>
          )}
        </figure>
      )
    case 'bookmark':
      if (!block.href) return null
      return (
        <p className="mb-4 text-[15px] text-ws-muted">
          via{' '}
          <a
            href={block.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ws-muted underline underline-offset-2 decoration-ws-muted/40 hover:text-ws-accent hover:decoration-ws-accent"
          >
            {hostnameOf(block.href)}
          </a>
        </p>
      )
    case 'divider':
      return <hr className="border-t border-ws-border my-10" aria-hidden="true" />
    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}
