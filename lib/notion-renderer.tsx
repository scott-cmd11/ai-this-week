import React from 'react'
import type { NotionBlock } from './types'

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
                <li key={block.id} className="text-[19px] text-govuk-black leading-[1.5]">
                  {block.content}
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

function Block({ block }: { block: NotionBlock }) {
  switch (block.type) {
    case 'heading_2':
      return (
        <h2 className="text-[27px] font-bold text-govuk-black mt-8 mb-4 leading-tight">
          {block.content}
        </h2>
      )
    case 'heading_3':
      return (
        <h3 className="text-[24px] font-bold text-govuk-black mt-6 mb-3 leading-tight">
          {block.content}
        </h3>
      )
    case 'paragraph':
      return block.content ? (
        <p className="text-[19px] text-govuk-black leading-[1.5] mb-4">
          {block.content}
        </p>
      ) : null
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
      return <hr className="border-govuk-mid-grey my-8" aria-hidden="true" />
    default:
      return null
  }
}

// Groups consecutive bulleted_list_items (and numbered_list_items) into arrays for <ul> rendering
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
