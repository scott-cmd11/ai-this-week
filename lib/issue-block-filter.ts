import type { NotionBlock } from './types'

const INTERNAL_SECTION_HEADINGS = new Set([
  'repair note',
  'internal note',
  'ops note',
])

export function isInternalSectionHeading(heading: string): boolean {
  return INTERNAL_SECTION_HEADINGS.has(heading.trim().toLowerCase())
}

export function publicIssueBlocks(blocks: NotionBlock[]): NotionBlock[] {
  const filtered: NotionBlock[] = []
  let skippingInternalSection = false

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      skippingInternalSection = isInternalSectionHeading(block.content)
      if (skippingInternalSection) continue
    }

    if (!skippingInternalSection) filtered.push(block)
  }

  return filtered
}
