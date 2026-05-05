// Shared "append article to today's draft" logic.
// Used by capture routes and bulk imports.

import { Client } from '@notionhq/client'
import { block, richText, formatIsoDate, todayUtc } from './notion-blocks'

export interface CaptureArticleInput {
  title: string
  annotation: string
  url: string
  publishedDate?: string | null
  imageUrl?: string | null
  category?: string | null
}

export interface CaptureResult {
  issueId: string
  issueNumber: number
  issueDate: string
  articleCount: number
}

export interface IssueTarget {
  issueId: string
  issueNumber: number
  issueDate: string
  title: string
  published: boolean
}

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

  const issueNumber = await getNextIssueNumber(notion, databaseId)
  const title = `AI Today - ${formatIsoDate(today)}`

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listAllChildBlocks(notion: Client, pageId: string): Promise<any[]> {
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
  return all
}

async function countArticleBlocks(notion: Client, pageId: string): Promise<number> {
  const allBlocks = await listAllChildBlocks(notion, pageId)
  return allBlocks.filter(b => b.type === 'heading_3').length
}

async function appendBlocksToSection(
  notion: Client,
  pageId: string,
  sectionHeading: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocksToAppend: any[],
) {
  if (!sectionHeading) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: blocksToAppend,
    })
    return
  }

  const allBlocks = await listAllChildBlocks(notion, pageId)
  let inTargetSection = false
  let foundTargetSection = false
  let insertAfterId: string | null = null

  for (const b of allBlocks) {
    if (b.type === 'heading_2') {
      const text = (b.heading_2?.rich_text ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r?.plain_text ?? '')
        .join('')
        .trim()
      inTargetSection = text === sectionHeading
      if (inTargetSection) foundTargetSection = true
    }

    if (inTargetSection) insertAfterId = b.id
  }

  if (foundTargetSection && insertAfterId) {
    await notion.blocks.children.append({
      block_id: pageId,
      after: insertAfterId,
      children: blocksToAppend,
    })
    return
  }

  await notion.blocks.children.append({
    block_id: pageId,
    children: [block.h2(sectionHeading), ...blocksToAppend],
  })
}

export async function appendArticleToIssue(
  notion: Client,
  issue: IssueTarget,
  article: CaptureArticleInput,
): Promise<CaptureResult> {
  const blocksToAppend = [
    block.h3(article.title),
    ...(article.publishedDate ? [block.paragraph(`Published: ${article.publishedDate}`)] : []),
    block.paragraph(article.annotation),
    block.bookmark(article.url),
    ...(article.imageUrl ? [block.image(article.imageUrl)] : []),
    block.divider(),
  ]

  await appendBlocksToSection(notion, issue.issueId, article.category?.trim() || null, blocksToAppend)

  return {
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount: await countArticleBlocks(notion, issue.issueId),
  }
}

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

export async function captureArticleToIssue(
  notion: Client,
  pageId: string,
  article: CaptureArticleInput,
): Promise<CaptureResult> {
  const issue = await getIssueTargetById(notion, pageId)
  if (!issue) throw new Error('Issue not found.')
  return appendArticleToIssue(notion, issue, article)
}

export interface CaptureEventInput {
  title: string
  when: string
  where: string
  description?: string | null
  url: string
}

const EVENTS_CATEGORY = 'Upcoming'

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
  const metaParts: string[] = []
  if (event.when.trim()) metaParts.push(`When: ${event.when.trim()}`)
  if (event.where.trim()) metaParts.push(`Where: ${event.where.trim()}`)
  const metaLine = metaParts.join(' - ')

  const blocksToAppend = [
    block.h3(event.title),
    ...(metaLine ? [block.paragraph(metaLine)] : []),
    ...(event.description?.trim() ? [block.paragraph(event.description.trim())] : []),
    block.bookmark(event.url),
    block.divider(),
  ]

  await appendBlocksToSection(notion, issue.issueId, EVENTS_CATEGORY, blocksToAppend)

  return {
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount: await countArticleBlocks(notion, issue.issueId),
  }
}

export async function captureEventToIssue(
  notion: Client,
  pageId: string,
  event: CaptureEventInput,
): Promise<CaptureResult> {
  const issue = await getIssueTargetById(notion, pageId)
  if (!issue) throw new Error('Issue not found.')
  return appendEventToIssue(notion, issue, event)
}
