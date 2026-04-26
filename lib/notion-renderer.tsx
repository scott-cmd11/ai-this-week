import React from 'react'
import type { NotionBlock, RichTextSegment } from './types'

interface Props {
  blocks: NotionBlock[]
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export function NotionRenderer({ blocks }: Props) {
  const items = groupBlocks(blocks)

  return (
    <div className="notion-body">
      {items.map(item => {
        if (item.kind === 'article') {
          return <ArticleEntry key={item.id} article={item} />
        }
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
    </div>
  )
}

// ─── Article grouping ───────────────────────────────────────────────────────────
// Walks the linear block list and groups consecutive
//   heading_3 + paragraph(s) + bookmark + image + (divider closes group)
// into an `ArticleGroup` so we can render each as a Simon-Willison-style entry:
// title-as-link + body + small "via hostname" attribution.

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
    // Bullets always group with each other (independent of articles)
    if (block.type === 'bulleted_list_item') {
      flushArticle()
      list.push(block)
      continue
    }
    flushList()

    if (block.type === 'heading_3') {
      // Starting a new article — close any previous one
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

    // Inside an article: absorb paragraph / bookmark / image / divider
    if (article) {
      if (block.type === 'paragraph') {
        // Skip "Published: …" metadata lines — the issue page already shows
        // issue date, no need to repeat it inside each article body.
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
        // Divider closes the article group — but is itself absorbed (not rendered).
        flushArticle()
        continue
      }
      // Anything else (heading_2, etc.) breaks the article — close and re-process
      flushArticle()
    }

    // Outside any article: pass through
    out.push({ kind: 'block', block })
  }

  flushList()
  flushArticle()
  return out
}

// ─── Article entry — Simon Willison link-blog style ─────────────────────────────

function ArticleEntry({ article }: { article: ArticleGroup }) {
  const { title, paragraphs, bookmarkUrl, imageUrl, imageAlt } = article
  const host = bookmarkUrl ? hostnameOf(bookmarkUrl) : null

  return (
    <article className="mb-12">
      <h3 className="text-[24px] sm:text-[26px] font-bold leading-snug mb-3 font-serif-body">
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
        ) : (
          title
        )}
      </h3>

      {imageUrl && (
        <figure className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full max-w-2xl border border-ws-border"
            loading="lazy"
          />
        </figure>
      )}

      {paragraphs.map(p => (
        <p
          key={p.id}
          className="text-[18px] text-ws-black leading-[1.6] mb-3 font-serif-body"
        >
          <RichText segments={p.richText} fallback={p.content} />
        </p>
      ))}

      {host && bookmarkUrl && (
        <p className="text-[13px] text-ws-muted mt-3 font-sans">
          via{' '}
          <a
            href={bookmarkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ws-muted underline underline-offset-2 decoration-ws-muted/40 hover:text-ws-accent hover:decoration-ws-accent"
          >
            {host}
          </a>
        </p>
      )}
    </article>
  )
}

// ─── Rich text — softer link styling than the previous bold/underline ──────────

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

// ─── Passthrough block rendering — for blocks outside any article group ────────

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
      // Should normally be absorbed into an article; render as fallback if seen alone
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
