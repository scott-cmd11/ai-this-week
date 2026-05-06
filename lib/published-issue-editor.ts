import { Client } from '@notionhq/client'

export interface EditablePublishedIssueItem {
  id: string
  section: string
  title: string
  titleBlockId: string
  blockIds: string[]
  summary: string
  summaryBlockId: string | null
  sourceUrl: string | null
  publishedDate: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotionBlockRecord = any

export async function listEditablePublishedIssueItems(
  notion: Client,
  pageId: string,
): Promise<EditablePublishedIssueItem[]> {
  const blocks = await listAllChildBlocks(notion, pageId)
  const items: EditablePublishedIssueItem[] = []

  let section = 'Unsectioned'
  let current: EditablePublishedIssueItem | null = null

  const flush = () => {
    if (!current) return
    if (current.title.trim()) items.push(current)
    current = null
  }

  for (const block of blocks) {
    if (block.type === 'heading_2') {
      flush()
      section = plainText(block) || 'Unsectioned'
      continue
    }

    if (block.type === 'heading_3') {
      flush()
      current = {
        id: block.id,
        section,
        title: plainText(block),
        titleBlockId: block.id,
        blockIds: [block.id],
        summary: '',
        summaryBlockId: null,
        sourceUrl: null,
        publishedDate: null,
      }
      continue
    }

    if (!current) continue
    current.blockIds.push(block.id)

    if (block.type === 'divider') {
      flush()
      continue
    }

    if (block.type === 'bookmark') {
      current.sourceUrl = block.bookmark?.url ?? current.sourceUrl
      continue
    }

    if (block.type !== 'paragraph') continue

    const text = plainText(block)
    if (!text) continue

    const sourceUrl = firstRichTextHref(block)
    if (sourceUrl && isSourceLine(text, sourceUrl)) {
      current.sourceUrl = sourceUrl
      continue
    }

    if (/^Published:/i.test(text)) {
      current.publishedDate = text.replace(/^Published:\s*/i, '').trim() || null
      continue
    }

    if (!current.summaryBlockId) {
      current.summary = text
      current.summaryBlockId = block.id
    }
  }

  flush()
  return items
}

export function richText(content: string) {
  return [{ type: 'text' as const, text: { content } }]
}

async function listAllChildBlocks(notion: Client, pageId: string): Promise<NotionBlockRecord[]> {
  const blocks: NotionBlockRecord[] = []
  let cursor: string | undefined

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    blocks.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return blocks
}

function plainText(block: NotionBlockRecord): string {
  const content = block[block.type]
  const richTextSegments = content?.rich_text ?? []
  return richTextSegments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((segment: any) => segment?.plain_text ?? '')
    .join('')
    .trim()
}

function firstRichTextHref(block: NotionBlockRecord): string | null {
  const richTextSegments = block.paragraph?.rich_text ?? []
  for (const segment of richTextSegments) {
    const href = segment?.href ?? segment?.text?.link?.url
    if (typeof href === 'string' && href.startsWith('http')) return href
  }
  return null
}

function isSourceLine(text: string, href: string): boolean {
  return text === href || /^https?:\/\//i.test(text)
}
