// ─── Shared "append article to today's draft" logic ─────────────────────────────
// Used by both /api/capture (single article from user/bookmarklet) and
// /api/import-briefing-articles (bulk import from briefing pages).

import { Client } from '@notionhq/client'
import { block, richText, formatIsoDate, todayUtc } from './notion-blocks'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface CaptureArticleInput {
  title: string
  annotation: string         // already-summarized text for the body paragraph
  url: string                // the source URL (becomes the bookmark)
  imageUrl?: string | null   // optional og:image / explicit override
}

export interface CaptureResult {
  issueId: string
  issueNumber: number
  issueDate: string          // YYYY-MM-DD
  articleCount: number       // h3 count after this append
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

/**
 * Returns the next available Issue Number across the database (max + 1).
 * Used when we need to create a brand-new draft for today.
 */
async function getNextIssueNumber(notion: Client, databaseId: string): Promise<number> {
  const response = await notion.databases.query({
    database_id: databaseId,
    sorts: [{ property: 'Issue Number', direction: 'descending' }],
    page_size: 1,
  })
  if (response.results.length === 0) return 1
  const page = response.results[0]
  if (page.object !== 'page' || !('properties' in page)) return 1
  const prop = page.properties['Issue Number']
  if (prop?.type !== 'number') return 1
  return (prop.number ?? 0) + 1
}

/**
 * Find today's unpublished draft, or create a fresh one if none exists.
 * Returns the page ID and assigned issue number.
 */
async function findOrCreateTodaysDraft(
  notion: Client,
  databaseId: string,
  today: string,
): Promise<{ issueId: string; issueNumber: number }> {
  const draftQuery = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        { property: 'Published', checkbox: { equals: false } },
        { property: 'Issue Date', date: { equals: today } },
      ],
    },
    page_size: 1,
  })

  if (draftQuery.results.length > 0) {
    const existing = draftQuery.results[0]
    let issueNumber = 0
    if (existing.object === 'page' && 'properties' in existing) {
      const prop = existing.properties['Issue Number']
      issueNumber = prop?.type === 'number' ? (prop.number ?? 0) : 0
    }
    return { issueId: existing.id, issueNumber }
  }

  // No draft yet — create one
  const issueNumber = await getNextIssueNumber(notion, databaseId)
  const title = `AI Today — ${formatIsoDate(today)}`

  const newPage = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Title: { title: richText(title) },
      'Issue Date': { date: { start: today } },
      'Issue Number': { number: issueNumber },
      Published: { checkbox: false },
      'AI Assisted': { checkbox: true },
    },
  })

  return { issueId: newPage.id, issueNumber }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Append a single article to today's AI Today draft.
 * Creates the draft if it doesn't exist yet.
 *
 * Caller is responsible for:
 *  - Authentication
 *  - URL validation
 *  - Generating the annotation (this function does NOT call OpenAI — pass
 *    pre-summarized text via `annotation`)
 *
 * Block structure appended per article:
 *  h3(title) + paragraph(annotation) + bookmark(url) + image?(imageUrl) + divider()
 */
export async function captureArticleToTodaysDraft(
  notion: Client,
  databaseId: string,
  article: CaptureArticleInput,
): Promise<CaptureResult> {
  const today = todayUtc()
  const { issueId, issueNumber } = await findOrCreateTodaysDraft(notion, databaseId, today)

  const blocksToAppend = [
    block.h3(article.title),
    block.paragraph(article.annotation),
    block.bookmark(article.url),
    ...(article.imageUrl ? [block.image(article.imageUrl)] : []),
    block.divider(),
  ]

  await notion.blocks.children.append({
    block_id: issueId,
    children: blocksToAppend,
  })

  // Count h3 blocks to give the caller an updated article count
  const allBlocks = await notion.blocks.children.list({ block_id: issueId, page_size: 100 })
  const articleCount = allBlocks.results.filter(
    b => 'type' in b && b.type === 'heading_3',
  ).length

  return { issueId, issueNumber, issueDate: today, articleCount }
}
