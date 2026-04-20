import { Client } from '@notionhq/client'
import type { Issue, NotionBlock, RichTextSegment } from './types'

// ─── Section types ────────────────────────────────────────────────────────────

export type SectionSlug = 'top' | 'bright' | 'tool' | 'podcast' | 'learning' | 'deep'

export interface SectionMeta {
  slug: SectionSlug
  label: string
  keyword: string   // matched (case-insensitive, contains) against h2 content
  emoji: string
}

export const SECTIONS: SectionMeta[] = [
  { slug: 'top',      label: 'Top Stories',             keyword: 'Top Stories',       emoji: '📰' },
  { slug: 'bright',   label: 'Bright Spot of the Week', keyword: 'Bright Spot',       emoji: '🌟' },
  { slug: 'tool',     label: 'Tool of the Week',        keyword: 'Tool of the Week',  emoji: '🔧' },
  { slug: 'podcast',  label: 'AI Podcast of the Week',  keyword: 'Podcast of the Week', emoji: '🎙️' },
  { slug: 'learning', label: 'Learning',                keyword: 'Learning',          emoji: '💡' },
  { slug: 'deep',     label: 'Deep Dive',               keyword: 'Deep Dive',         emoji: '📖' },
]

export interface SectionArticle {
  issueNumber: number
  issueDate: string
  issueTitle: string
  issueSlug: string
  articleTitle: string | null
  articleUrl: string | null
  summary: string | null
}

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

/**
 * Returns up to `limit` issues for a "related" block — excludes the current
 * issue and its immediate prev/next (already shown in nav) so readers discover
 * something beyond adjacent weeks.
 */
export async function getRelatedIssues(date: string, limit = 3): Promise<Issue[]> {
  const issues = await getPublishedIssues()
  const idx = issues.findIndex(i => i.issueDate === date)
  if (idx === -1) return issues.slice(0, limit)

  const prevIdx = idx + 1
  const nextIdx = idx - 1
  const excluded = new Set([idx, prevIdx, nextIdx])

  return issues.filter((_, i) => !excluded.has(i)).slice(0, limit)
}

export async function getArticlesBySection(keyword: string): Promise<SectionArticle[]> {
  const issues = await getPublishedIssues()
  // Fetch all issue blocks in parallel — fine for newsletter-scale (< 100 issues)
  const allBlocks = await Promise.all(
    issues.map(issue => getIssueBlocks(issue.id).then(blocks => ({ issue, blocks })))
  )
  return allBlocks.flatMap(({ issue, blocks }) =>
    parseSectionArticles(blocks, issue, keyword)
  )
}

function parseSectionArticles(
  blocks: NotionBlock[],
  issue: Issue,
  keyword: string
): SectionArticle[] {
  // Find the h2 heading that contains the keyword
  const h2Idx = blocks.findIndex(
    b => b.type === 'heading_2' && b.content.toLowerCase().includes(keyword.toLowerCase())
  )
  if (h2Idx === -1) return []

  // Collect blocks up to the next h2 or divider
  const section: NotionBlock[] = []
  for (let i = h2Idx + 1; i < blocks.length; i++) {
    if (blocks[i].type === 'heading_2' || blocks[i].type === 'divider') break
    section.push(blocks[i])
  }

  // Parse articles: a linked-title paragraph followed by an optional summary paragraph
  const articles: SectionArticle[] = []
  let i = 0
  while (i < section.length) {
    const block = section[i]
    // Linked-title: paragraph where at least one rich-text segment has an href
    const isLinkedTitle =
      block.type === 'paragraph' &&
      block.richText?.some(seg => seg.href)

    if (isLinkedTitle) {
      const articleTitle = block.content || null
      const articleUrl = block.richText?.find(seg => seg.href)?.href ?? null

      // Peek ahead for a summary (skip Published: lines, images, bookmarks)
      let summary: string | null = null
      for (let j = i + 1; j < section.length; j++) {
        const next = section[j]
        if (next.type === 'paragraph' && next.content && !next.content.startsWith('Published:')) {
          // Make sure it's not another linked title
          if (!next.richText?.some(seg => seg.href)) {
            summary = next.content
            i = j // advance past the summary
          }
          break
        }
        // Stop if we hit another potential title
        if (next.type === 'paragraph' && next.richText?.some(seg => seg.href)) break
      }

      articles.push({
        issueNumber: issue.issueNumber,
        issueDate: issue.issueDate,
        issueTitle: issue.title,
        issueSlug: issue.slug,
        articleTitle,
        articleUrl,
        summary,
      })
    }
    i++
  }
  return articles
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

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const richTextToString = (richText: any[]): string =>
    (richText ?? []).map((t: any) => t.plain_text).join('')

  const richTextToSegments = (richText: any[]): RichTextSegment[] =>
    (richText ?? []).map((t: any) => ({
      text: t.plain_text ?? '',
      bold: t.annotations?.bold ?? false,
      href: t.text?.link?.url ?? null,
    }))
  /* eslint-enable @typescript-eslint/no-explicit-any */

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
