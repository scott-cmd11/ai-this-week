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
  publishedDate?: string | null
  imageUrl?: string | null   // optional og:image / explicit override
  category?: string | null   // canonical category name; if set, article is
                             // placed under a "## {Category}" h2 section
}

export interface CaptureResult {
  issueId: string
  issueNumber: number
  issueDate: string          // YYYY-MM-DD
  articleCount: number       // h3 count after this append
}

export interface IssueTarget {
  issueId: string
  issueNumber: number
  issueDate: string
  title: string
  published: boolean
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function issueTargetFromPage(page: any): IssueTarget | null {
  if (page.object !== 'page' || !('properties' in page)) return null
  const props = page.properties
  const issueNumber = props['Issue Number']?.type === 'number' ? (props['Issue Number'].number ?? 0) : 0
  const issueDate = props['Issue Date']?.type === 'date' ? (props['Issue Date'].date?.start ?? '') : ''
  const title = props['Title']?.type === 'title'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Title'].title?.map((item: any) => item?.plain_text ?? '').join('').trim()
    : ''
  const published = props['Published']?.type === 'checkbox' ? props['Published'].checkbox : false

  if (!issueNumber || !issueDate) return null
  return { issueId: page.id, issueNumber, issueDate, title, published }
}

export async function getIssueTargetById(
  notion: Client,
  issueId: string,
): Promise<IssueTarget | null> {
  const page = await notion.pages.retrieve({ page_id: issueId })
  return issueTargetFromPage(page)
}

export async function getIssueTargetByDate(
  notion: Client,
  databaseId: string,
  issueDate: string,
  publishedOnly = true,
): Promise<IssueTarget | null> {
  const query = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        { property: 'Issue Date', date: { equals: issueDate } },
        ...(publishedOnly ? [{ property: 'Published', checkbox: { equals: true } }] : []),
      ],
    },
    page_size: 1,
  })

  if (query.results.length === 0) return null
  return issueTargetFromPage(query.results[0])
}

/**
 * Returns the text of the most recent heading_2 in the page, or null if none.
 * Used to decide whether we need to insert a new h2 marker before an article.
 */
async function lastHeadingText(notion: Client, pageId: string): Promise<string | null> {
  // Walk backward through paginated blocks. Notion's API doesn't expose a
  // reverse cursor, so we fetch all and scan from the end. Issue drafts are
  // small enough (~100 blocks max) that this is cheap.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    all.push(...res.results)
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)

  for (let i = all.length - 1; i >= 0; i--) {
    const b = all[i]
    if (b.type === 'heading_2') {
      const text = (b.heading_2?.rich_text ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r?.plain_text ?? '')
        .join('')
      return text
    }
  }
  return null
}

async function countArticleHeadings(notion: Client, pageId: string): Promise<number> {
  let articleCount = 0
  let cursor: string | undefined

  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    articleCount += res.results.filter(
      b => 'type' in b && b.type === 'heading_3',
    ).length
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)

  return articleCount
}

export async function appendArticleToIssue(
  notion: Client,
  issue: IssueTarget,
  article: CaptureArticleInput,
): Promise<CaptureResult> {
  const blocksToAppend = []
  if (article.category) {
    const lastHeading = await lastHeadingText(notion, issue.issueId)
    if (lastHeading !== article.category) {
      blocksToAppend.push(block.h2(article.category))
    }
  }

  blocksToAppend.push(
    block.h3(article.title),
    ...(article.publishedDate ? [block.paragraph(`Published: ${article.publishedDate}`)] : []),
    block.paragraph(article.annotation),
    block.bookmark(article.url),
    ...(article.imageUrl ? [block.image(article.imageUrl)] : []),
    block.divider(),
  )

  await notion.blocks.children.append({
    block_id: issue.issueId,
    children: blocksToAppend,
  })

  const articleCount = await countArticleHeadings(notion, issue.issueId)

  return {
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount,
  }
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
 *  [h2(category) if category changed] +
 *  h3(title) + paragraph(published date?) + paragraph(annotation) + bookmark(url) + image?(imageUrl) + divider()
 *
 * If `category` is null/undefined, no h2 marker is inserted — the article
 * appears uncategorized (legacy behavior).
 *
 * For bulk import, pre-sort articles by category to minimize duplicate h2s.
 */
export async function captureArticleToTodaysDraft(
  notion: Client,
  databaseId: string,
  article: CaptureArticleInput,
): Promise<CaptureResult> {
  const today = todayUtc()
  const { issueId, issueNumber } = await findOrCreateTodaysDraft(notion, databaseId, today)
  return appendArticleToIssue(
    notion,
    { issueId, issueNumber, issueDate: today, title: '', published: false },
    article,
  )
}

// ─── Event capture ─────────────────────────────────────────────────────────────
// Learning events have a different block shape than articles:
//   ## Upcoming                         (h2, fixed category)
//   ### Event title                     (h3)
//   When: <date/time> · Where: <place>  (paragraph — meta line)
//   <description>                       (paragraph — only if non-empty)
//   bookmark(registerUrl)
//   divider

export interface CaptureEventInput {
  title: string
  /** Free-text date/time (e.g. "Apr 28, 2pm ET" or "Wednesday, May 7"). */
  when: string
  /** Free-text location/format (e.g. "Virtual", "Toronto", "Hybrid — Vancouver"). */
  where: string
  /** Optional description / blurb. */
  description?: string | null
  /** Registration / event URL. Becomes the bookmark. */
  url: string
}

const EVENTS_CATEGORY = 'Upcoming'

/**
 * Append a single learning event to today's draft.
 * Always grouped under a fixed "## Upcoming" h2 section.
 */
export async function captureEventToTodaysDraft(
  notion: Client,
  databaseId: string,
  event: CaptureEventInput,
): Promise<CaptureResult> {
  const today = todayUtc()
  const { issueId, issueNumber } = await findOrCreateTodaysDraft(notion, databaseId, today)
  return appendEventToIssue(
    notion,
    { issueId, issueNumber, issueDate: today, title: '', published: false },
    event,
  )
}

export async function appendEventToIssue(
  notion: Client,
  issue: IssueTarget,
  event: CaptureEventInput,
): Promise<CaptureResult> {
  const issueId = issue.issueId

  const lastHeading = await lastHeadingText(notion, issueId)
  const blocksToAppend = []
  if (lastHeading !== EVENTS_CATEGORY) {
    blocksToAppend.push(block.h2(EVENTS_CATEGORY))
  }

  // "When: …  ·  Where: …" meta line
  const metaParts: string[] = []
  if (event.when.trim()) metaParts.push(`When: ${event.when.trim()}`)
  if (event.where.trim()) metaParts.push(`Where: ${event.where.trim()}`)
  const metaLine = metaParts.join('  ·  ')

  blocksToAppend.push(
    block.h3(event.title),
    ...(metaLine ? [block.paragraph(metaLine)] : []),
    ...(event.description?.trim() ? [block.paragraph(event.description.trim())] : []),
    block.bookmark(event.url),
    block.divider(),
  )

  await notion.blocks.children.append({
    block_id: issueId,
    children: blocksToAppend,
  })

  const articleCount = await countArticleHeadings(notion, issueId)

  return {
    issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount,
  }
}
