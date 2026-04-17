import { Client } from '@notionhq/client'
import type { Issue, NotionBlock, BlockType, RichTextSegment } from './types'

if (!process.env.NOTION_TOKEN) {
  throw new Error('Missing environment variable: NOTION_TOKEN')
}
if (!process.env.NOTION_DATABASE_ID) {
  throw new Error('Missing environment variable: NOTION_DATABASE_ID')
}

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID!

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getPublishedIssues(): Promise<Issue[]> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Published',
      checkbox: { equals: true },
    },
    sorts: [{ property: 'Issue Date', direction: 'descending' }],
  })
  return response.results.map(mapPageToIssue)
}

export async function getLatestIssue(): Promise<Issue | null> {
  const issues = await getPublishedIssues()
  return issues[0] ?? null
}

export async function getIssueByDate(date: string): Promise<Issue | null> {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      and: [
        { property: 'Published', checkbox: { equals: true } },
        { property: 'Issue Date', date: { equals: date } },
      ],
    },
  })
  if (response.results.length === 0) return null
  return mapPageToIssue(response.results[0])
}

export async function getIssueBlocks(pageId: string): Promise<NotionBlock[]> {
  const response = await notion.blocks.children.list({ block_id: pageId })
  return response.results.map(mapBlockToNotionBlock)
}

export async function getAdjacentIssues(date: string): Promise<{ prev: Issue | null; next: Issue | null }> {
  const issues = await getPublishedIssues() // already sorted descending by date
  const idx = issues.findIndex(i => i.issueDate === date)
  if (idx === -1) return { prev: null, next: null }
  // "next" = more recent = lower index; "prev" = older = higher index
  return {
    next: idx > 0 ? issues[idx - 1] : null,
    prev: idx < issues.length - 1 ? issues[idx + 1] : null,
  }
}

// ─── Mappers (exported for testing) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPageToIssue(page: any): Issue {
  const props = page.properties
  const issueDate: string = props['Issue Date'].date?.start ?? ''
  return {
    id: page.id,
    title: props.Title.title[0]?.plain_text ?? '',
    issueDate,
    issueNumber: props['Issue Number'].number ?? 0,
    published: props.Published.checkbox,
    summary: props.Summary.rich_text[0]?.plain_text ?? '',
    aiAssisted: props['AI Assisted'].checkbox,
    slug: issueDate,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBlockToNotionBlock(block: any): NotionBlock {
  const type: string = block.type
  const content = block[type]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richTextToString = (richText: any[]): string =>
    (richText ?? []).map((t: any) => t.plain_text).join('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richTextToSegments = (richText: any[]): RichTextSegment[] =>
    (richText ?? []).map((t: any) => ({
      text: t.plain_text ?? '',
      bold: t.annotations?.bold ?? false,
      href: t.text?.link?.url ?? null,
    }))

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  switch (type) {
    case 'paragraph': {
      const rt = content.rich_text ?? []
      return {
        id: block.id,
        type: 'paragraph',
        content: richTextToString(rt),
        richText: richTextToSegments(rt),
      }
    }
    case 'heading_2': {
      const text = richTextToString(content.rich_text)
      return {
        id: block.id,
        type: 'heading_2',
        content: text,
        headingId: slugify(text),
      }
    }
    case 'heading_3':
      return { id: block.id, type: 'heading_3', content: richTextToString(content.rich_text) }
    case 'bulleted_list_item': {
      const rt = content.rich_text ?? []
      return {
        id: block.id,
        type: 'bulleted_list_item',
        content: richTextToString(rt),
        richText: richTextToSegments(rt),
      }
    }
    case 'numbered_list_item': {
      const rt = content.rich_text ?? []
      return {
        id: block.id,
        type: 'numbered_list_item',
        content: richTextToString(rt),
        richText: richTextToSegments(rt),
      }
    }
    case 'bookmark':
      return {
        id: block.id,
        type: 'bookmark',
        content: content.caption?.[0]?.plain_text ?? 'Read more',
        href: content.url,
      }
    case 'divider':
      return { id: block.id, type: 'divider', content: '' }
    case 'image': {
      const url = content?.external?.url ?? content?.file?.url ?? ''
      const caption = richTextToString(content?.caption ?? [])
      return { id: block.id, type: 'image', content: caption || url, href: url }
    }
    default:
      return { id: block.id, type: 'paragraph', content: richTextToString(content?.rich_text ?? []) }
  }
}
