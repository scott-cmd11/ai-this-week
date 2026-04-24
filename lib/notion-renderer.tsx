import React from 'react'
import type { NotionBlock, RichTextSegment } from './types'

interface Props {
  blocks: NotionBlock[]
}

export function NotionRenderer({ blocks }: Props) {
  const grouped = groupBulletedLists(blocks)

  return (
    <div className="notion-body">
      {grouped.map((item) => {
        if (Array.isArray(item)) {
          return (
            <ul key={item[0].id} className="list-disc pl-6 mb-4 space-y-2">
              {item.map(block => (
                <li key={block.id} className="text-[19px] text-ws-black leading-[1.5]">
                  <RichText segments={block.richText} fallback={block.content} />
                </li>
              ))}
            </ul>
          )
        }
        return <Block key={item.id} block={item} />
      })}
    </div>
  )
}

/** Renders an array of rich text segments, falling back to plain text if none */
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
              className="text-ws-black underline font-bold hover:text-ws-accent focus:outline-none focus:bg-neopop-yellow"
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
          className="text-[28px] font-black uppercase tracking-tight text-ws-black mt-10 mb-4 leading-tight"
        >
          {block.content}
        </h2>
      )
    case 'heading_3':
      return (
        <h3 className="text-[22px] font-black text-ws-black mt-6 mb-3 leading-tight">
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
        <p className="mb-4">
          <a
            href={block.href}
            className="text-govuk-blue text-[19px] underline hover:text-govuk-black focus:outline-none focus:bg-govuk-yellow focus:text-govuk-black"
            target="_blank"
            rel="noopener noreferrer"
          >
            {block.content}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </p>
      )
    case 'divider':
      return <hr className="border-t-[3px] border-neopop-black my-10 w-20" aria-hidden="true" />
    default:
      return null
  }
}

// Groups consecutive bulleted_list_items into arrays for <ul> rendering
function groupBulletedLists(blocks: NotionBlock[]): (NotionBlock | NotionBlock[])[] {
  const result: (NotionBlock | NotionBlock[])[] = []
  let currentList: NotionBlock[] = []

  for (const block of blocks) {
    if (block.type === 'bulleted_list_item') {
      currentList.push(block)
    } else {
      if (currentList.length > 0) {
        result.push([...currentList])
        currentList = []
      }
      result.push(block)
    }
  }

  if (currentList.length > 0) result.push([...currentList])
  return result
}
