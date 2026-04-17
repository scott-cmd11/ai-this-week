import type { NotionBlock, RichTextSegment } from './types'

/**
 * Converts an array of Notion blocks into Markdown suitable for pasting into
 * Slack, email, or any Markdown-aware editor.
 */
export function blocksToMarkdown(title: string, blocks: NotionBlock[]): string {
  const lines: string[] = [`# ${title}`, '']

  for (const block of blocks) {
    switch (block.type) {
      case 'heading_2':
        lines.push('', `## ${block.content}`, '')
        break
      case 'heading_3':
        lines.push('', `### ${block.content}`, '')
        break
      case 'paragraph':
        if (block.content) lines.push(renderInline(block), '')
        break
      case 'bulleted_list_item':
        lines.push(`- ${renderInline(block)}`)
        break
      case 'numbered_list_item':
        lines.push(`1. ${renderInline(block)}`)
        break
      case 'bookmark':
        if (block.href) lines.push(`🔗 [${block.content || block.href}](${block.href})`, '')
        break
      case 'image':
        if (block.href) lines.push(`![${block.content !== block.href ? block.content : ''}](${block.href})`, '')
        break
      case 'divider':
        lines.push('', '---', '')
        break
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function renderInline(block: NotionBlock): string {
  if (!block.richText || block.richText.length === 0) return block.content
  return block.richText.map(segmentToMarkdown).join('')
}

function segmentToMarkdown(seg: RichTextSegment): string {
  let text = seg.text
  if (seg.bold) text = `**${text}**`
  if (seg.href) text = `[${text}](${seg.href})`
  return text
}
