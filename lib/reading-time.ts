import type { NotionBlock } from './types'

/**
 * Estimates reading time from a list of Notion blocks.
 * Assumes ~238 words per minute (average adult silent reading speed).
 */
export function estimateReadingTime(blocks: NotionBlock[]): number {
  const text = blocks
    .filter(b => b.type !== 'divider' && b.type !== 'image' && b.type !== 'bookmark')
    .map(b => b.content)
    .join(' ')

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.ceil(wordCount / 238)
  return Math.max(1, minutes)
}
