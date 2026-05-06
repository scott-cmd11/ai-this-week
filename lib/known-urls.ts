// ─── Known-URLs index ──────────────────────────────────────────────────────────
// Builds a map of normalized URL → metadata about which issue it appeared in.
// Used by /api/known-urls (returns the full set to admin panels) and by
// /api/capture (looks up a single URL before saving, blocks accidental dupes).

import { Client } from '@notionhq/client'
import { normalizeUrl } from './url-normalize'

export interface KnownUrlEntry {
  pageId: string
  issueNumber: number
  issueDate: string  // YYYY-MM-DD
  published: boolean
}

export interface KnownTitleEntry extends KnownUrlEntry {
  title: string
}

/** Map of normalized URL → metadata for the issue where it first appeared. */
export type KnownUrlMap = Map<string, KnownUrlEntry>

function daysAgoUtc(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

/**
 * Walk all blocks of a page (paginated) and collect source URLs. Most current
 * issues store links as bookmark blocks, but older/manual edits can store them
 * as linked rich-text segments.
 */
async function fetchIssueUrls(notion: Client, pageId: string): Promise<string[]> {
  const urls: string[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    for (const b of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = b as any
      if (block.type === 'bookmark' && typeof block.bookmark?.url === 'string') {
        urls.push(block.bookmark.url)
      }
      const richText = block[block.type]?.rich_text
      if (Array.isArray(richText)) {
        for (const segment of richText) {
          if (typeof segment?.href === 'string') urls.push(segment.href)
        }
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)
  return urls
}

async function fetchIssueTitles(notion: Client, pageId: string): Promise<string[]> {
  const titles: string[] = []
  let cursor: string | undefined
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor,
    })
    for (const b of res.results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = b as any
      if (block.type !== 'heading_3') continue
      const title = (block.heading_3?.rich_text ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((segment: any) => segment?.plain_text ?? '')
        .join('')
        .trim()
      if (title) titles.push(title)
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined
  } while (cursor)
  return titles
}

/**
 * Build the known-URLs index for the last `days` days (default 30).
 *
 * Includes both published and draft issues — so the index also catches
 * "already in today's draft" cases (e.g. user accidentally pastes the
 * same URL twice in a row).
 */
export async function buildKnownUrlMap(
  notion: Client,
  databaseId: string,
  days = 30,
): Promise<KnownUrlMap> {
  const sinceDate = daysAgoUtc(days)

  const queryRes = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Issue Date',
      date: { on_or_after: sinceDate },
    },
    sorts: [{ property: 'Issue Date', direction: 'descending' }],
    page_size: 100,
  })

  // Extract per-issue metadata up front so we can attach it to each URL
  const issues: { pageId: string; issueNumber: number; issueDate: string; published: boolean }[] = []
  for (const page of queryRes.results) {
    if (page.object !== 'page' || !('properties' in page)) continue
    const props = page.properties
    const issueNumber = props['Issue Number']?.type === 'number' ? (props['Issue Number'].number ?? 0) : 0
    const issueDate = props['Issue Date']?.type === 'date' ? (props['Issue Date'].date?.start ?? '') : ''
    const published = props['Published']?.type === 'checkbox' ? props['Published'].checkbox : false
    if (!issueDate) continue
    issues.push({ pageId: page.id, issueNumber, issueDate, published })
  }

  // Fetch bookmarks from every issue in parallel
  const allUrlsArrays = await Promise.all(
    issues.map(async issue => {
      const urls = await fetchIssueUrls(notion, issue.pageId)
      return { issue, urls }
    }),
  )

  // Build the map. If a URL appears in multiple issues, keep the FIRST one
  // we hit (the most recent, since we sorted descending) — that's the most
  // useful "already published" pointer for the user.
  const map: KnownUrlMap = new Map()
  for (const { issue, urls } of allUrlsArrays) {
    for (const u of urls) {
      const n = normalizeUrl(u)
      if (!n) continue
      if (!map.has(n)) map.set(n, issue)
    }
  }

  return map
}

export async function buildKnownTitleList(
  notion: Client,
  databaseId: string,
  days = 30,
): Promise<KnownTitleEntry[]> {
  const sinceDate = daysAgoUtc(days)

  const queryRes = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Issue Date',
      date: { on_or_after: sinceDate },
    },
    sorts: [{ property: 'Issue Date', direction: 'descending' }],
    page_size: 100,
  })

  const issues: KnownUrlEntry[] = []
  for (const page of queryRes.results) {
    if (page.object !== 'page' || !('properties' in page)) continue
    const props = page.properties
    const issueNumber = props['Issue Number']?.type === 'number' ? (props['Issue Number'].number ?? 0) : 0
    const issueDate = props['Issue Date']?.type === 'date' ? (props['Issue Date'].date?.start ?? '') : ''
    const published = props['Published']?.type === 'checkbox' ? props['Published'].checkbox : false
    if (!issueDate) continue
    issues.push({ pageId: page.id, issueNumber, issueDate, published })
  }

  const titleGroups = await Promise.all(
    issues.map(async issue => {
      const titles = await fetchIssueTitles(notion, issue.pageId)
      return titles.map(title => ({ ...issue, title }))
    }),
  )

  return titleGroups.flat()
}
