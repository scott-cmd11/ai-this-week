import 'server-only'

import type { Issue, NotionBlock } from './types'
import { issueDateFor } from './issue-date'
import { formatIsoDate } from './notion-blocks'

export type StoredIssue = Issue
export type SectionSlug =
  | 'canada'
  | 'policy-regulation'
  | 'government-public-sector'
  | 'industry-models'
  | 'sectors-applications'
  | 'research'

export interface SectionMeta {
  slug: SectionSlug
  label: string
  keyword: string
  code: string
}

export const SECTIONS: SectionMeta[] = [
  { slug: 'canada', label: 'Canada', keyword: 'Canada', code: 'CAN' },
  { slug: 'policy-regulation', label: 'Policy & Regulation', keyword: 'Policy & Regulation', code: 'POL' },
  {
    slug: 'government-public-sector',
    label: 'Government & Public Sector',
    keyword: 'Government & Public Sector',
    code: 'GOV',
  },
  { slug: 'industry-models', label: 'Industry & Models', keyword: 'Industry & Models', code: 'IND' },
  {
    slug: 'sectors-applications',
    label: 'Sectors & Applications',
    keyword: 'Sectors & Applications',
    code: 'APP',
  },
  { slug: 'research', label: 'Research', keyword: 'Research', code: 'RES' },
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

interface IssueRow {
  id: string
  title: string
  issue_date: string
  issue_number: number
  published: boolean
  summary: string | null
  ai_assisted: boolean
  blocks: NotionBlock[] | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CaptureArticleInput {
  title: string
  annotation: string
  url: string
  publishedDate?: string | null
  imageUrl?: string | null
  category?: string | null
}

export interface CaptureEventInput {
  title: string
  when: string
  where: string
  description?: string | null
  url: string
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

export interface KnownIssueEntry {
  pageId: string
  issueNumber: number
  issueDate: string
  published: boolean
  title: string
}

export interface KnownUrlEntry extends KnownIssueEntry {
  url: string
}

export interface KnownTitleEntry extends KnownIssueEntry {
  title: string
}

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

export function isIssueStoreConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Issue store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return { url: url.replace(/\/$/, ''), key }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseConfig()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase request failed (${res.status}): ${body || res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function mapIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    title: row.title,
    issueDate: row.issue_date,
    issueNumber: row.issue_number,
    published: row.published,
    summary: row.summary ?? '',
    aiAssisted: row.ai_assisted,
    slug: row.issue_date,
  }
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function blockId() {
  return crypto.randomUUID()
}

function h2(content: string): NotionBlock {
  return { id: blockId(), type: 'heading_2', content, headingId: slugify(content) }
}

function h3(content: string): NotionBlock {
  return { id: blockId(), type: 'heading_3', content }
}

function paragraph(content: string): NotionBlock {
  return { id: blockId(), type: 'paragraph', content, richText: [{ text: content }] }
}

function bookmark(url: string): NotionBlock {
  return { id: blockId(), type: 'bookmark', content: 'Read more', href: url }
}

function image(url: string): NotionBlock {
  return { id: blockId(), type: 'image', content: url, href: url }
}

function divider(): NotionBlock {
  return { id: blockId(), type: 'divider', content: '' }
}

async function getIssueRowById(issueId: string): Promise<IssueRow | null> {
  const params = new URLSearchParams({ select: '*', id: `eq.${issueId}`, limit: '1' })
  const rows = await supabaseRequest<IssueRow[]>(`issues?${params.toString()}`)
  return rows[0] ?? null
}

export async function getIssueById(issueId: string): Promise<Issue | null> {
  if (!isIssueStoreConfigured()) return null
  const row = await getIssueRowById(issueId)
  return row ? mapIssue(row) : null
}

export async function getPublishedIssues(): Promise<Issue[]> {
  if (!isIssueStoreConfigured()) return []
  const params = new URLSearchParams({
    select: 'id,title,issue_date,issue_number,published,summary,ai_assisted,published_at,created_at,updated_at',
    published: 'eq.true',
    order: 'issue_date.desc',
  })
  const rows = await supabaseRequest<IssueRow[]>(`issues?${params.toString()}`)
  return rows.map(mapIssue)
}

export async function getLatestIssue(): Promise<Issue | null> {
  const issues = await getPublishedIssues()
  return issues[0] ?? null
}

export async function getIssueByDate(date: string, publishedOnly = true): Promise<Issue | null> {
  if (!isIssueStoreConfigured()) return null
  const params = new URLSearchParams({
    select: 'id,title,issue_date,issue_number,published,summary,ai_assisted,published_at,created_at,updated_at',
    issue_date: `eq.${date}`,
    limit: '1',
  })
  if (publishedOnly) params.set('published', 'eq.true')
  const rows = await supabaseRequest<IssueRow[]>(`issues?${params.toString()}`)
  return rows[0] ? mapIssue(rows[0]) : null
}

export async function getIssueBlocks(issueId: string): Promise<NotionBlock[]> {
  if (!isIssueStoreConfigured()) return []
  const params = new URLSearchParams({ select: 'blocks', id: `eq.${issueId}`, limit: '1' })
  const rows = await supabaseRequest<Pick<IssueRow, 'blocks'>[]>(`issues?${params.toString()}`)
  return rows[0]?.blocks ?? []
}

export async function getAdjacentIssues(date: string): Promise<{ prev: Issue | null; next: Issue | null }> {
  const issues = await getPublishedIssues()
  const idx = issues.findIndex(i => i.issueDate === date)
  if (idx === -1) return { prev: null, next: null }
  return {
    next: idx > 0 ? issues[idx - 1] : null,
    prev: idx < issues.length - 1 ? issues[idx + 1] : null,
  }
}

export async function getRelatedIssues(date: string, limit = 3): Promise<Issue[]> {
  const issues = await getPublishedIssues()
  const idx = issues.findIndex(i => i.issueDate === date)
  if (idx === -1) return issues.slice(0, limit)
  const excluded = new Set([idx, idx + 1, idx - 1])
  return issues.filter((_, i) => !excluded.has(i)).slice(0, limit)
}

export async function getArticlesBySection(keyword: string): Promise<SectionArticle[]> {
  const issues = await listAllIssues()
  return issues
    .filter(issue => issue.published)
    .flatMap(issue => parseSectionArticles(issue.blocks, issue, keyword))
}

function parseSectionArticles(
  blocks: NotionBlock[],
  issue: Issue,
  keyword: string,
): SectionArticle[] {
  const h2Idx = blocks.findIndex(
    b => b.type === 'heading_2' && b.content.toLowerCase().includes(keyword.toLowerCase()),
  )
  if (h2Idx === -1) return []

  const section: NotionBlock[] = []
  for (let i = h2Idx + 1; i < blocks.length; i++) {
    if (blocks[i].type === 'heading_2' || blocks[i].type === 'divider') break
    section.push(blocks[i])
  }

  const articles: SectionArticle[] = []
  let i = 0
  while (i < section.length) {
    const block = section[i]
    if (block.type === 'heading_3') {
      let articleUrl: string | null = null
      let summary: string | null = null
      for (let j = i + 1; j < section.length; j++) {
        const next = section[j]
        if (next.type === 'heading_3') break
        if (next.type === 'bookmark' && next.href) articleUrl = next.href
        if (next.type === 'paragraph' && next.content && !next.content.startsWith('Published:') && !summary) {
          summary = next.content
        }
      }
      articles.push({
        issueNumber: issue.issueNumber,
        issueDate: issue.issueDate,
        issueTitle: issue.title,
        issueSlug: issue.slug,
        articleTitle: block.content || null,
        articleUrl,
        summary,
      })
    }
    i++
  }
  return articles
}

async function getNextIssueNumber(): Promise<number> {
  const params = new URLSearchParams({ select: 'issue_number', order: 'issue_number.desc', limit: '1' })
  const rows = await supabaseRequest<Pick<IssueRow, 'issue_number'>[]>(`issues?${params.toString()}`)
  return (rows[0]?.issue_number ?? 0) + 1
}

export async function findOrCreateTodaysDraft(today = issueDateFor()): Promise<IssueTarget> {
  const existing = await getIssueByDate(today, false)
  if (existing) {
    if (existing.published) {
      throw new Error('Today\'s issue is already published. Use the live issue desk to add late items.')
    }
    return {
      issueId: existing.id,
      issueNumber: existing.issueNumber,
      issueDate: existing.issueDate,
      title: existing.title,
      published: existing.published,
    }
  }

  const issueNumber = await getNextIssueNumber()
  const title = `AI Today - ${formatIsoDate(today)}`
  const rows = await supabaseRequest<IssueRow[]>('issues', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title,
      issue_date: today,
      issue_number: issueNumber,
      published: false,
      ai_assisted: true,
      blocks: [],
    }),
  })
  const issue = mapIssue(rows[0])
  return {
    issueId: issue.id,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    title: issue.title,
    published: issue.published,
  }
}

export async function findOrCreateDraftByDate(issueDate: string): Promise<IssueTarget> {
  const normalizedDate = issueDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error('Issue date must use YYYY-MM-DD format.')
  }

  const existing = await getIssueByDate(normalizedDate, false)
  if (existing) {
    return {
      issueId: existing.id,
      issueNumber: existing.issueNumber,
      issueDate: existing.issueDate,
      title: existing.title,
      published: existing.published,
    }
  }

  const issueNumber = await getNextIssueNumber()
  const title = `AI Today - ${formatIsoDate(normalizedDate)}`
  const rows = await supabaseRequest<IssueRow[]>('issues', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title,
      issue_date: normalizedDate,
      issue_number: issueNumber,
      published: false,
      ai_assisted: true,
      blocks: [],
    }),
  })
  const issue = mapIssue(rows[0])
  return {
    issueId: issue.id,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    title: issue.title,
    published: issue.published,
  }
}

export async function getIssueTargetById(issueId: string): Promise<IssueTarget | null> {
  const row = await getIssueRowById(issueId)
  if (!row) return null
  return {
    issueId: row.id,
    issueNumber: row.issue_number,
    issueDate: row.issue_date,
    title: row.title,
    published: row.published,
  }
}

export async function getIssueTargetByDate(
  issueDate: string,
  publishedOnly = true,
): Promise<IssueTarget | null> {
  const issue = await getIssueByDate(issueDate, publishedOnly)
  if (!issue) return null
  return {
    issueId: issue.id,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    title: issue.title,
    published: issue.published,
  }
}

function insertIntoSection(blocks: NotionBlock[], sectionHeading: string | null, blocksToAppend: NotionBlock[]) {
  if (!sectionHeading) return [...blocks, ...blocksToAppend]

  let found = false
  let insertAt = -1
  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i]
    if (current.type === 'heading_2') {
      if (found) break
      found = current.content.trim() === sectionHeading
    }
    if (found) insertAt = i + 1
  }

  if (!found) return [...blocks, h2(sectionHeading), ...blocksToAppend]
  return [...blocks.slice(0, insertAt), ...blocksToAppend, ...blocks.slice(insertAt)]
}

async function updateIssueBlocks(issueId: string, blocks: NotionBlock[]): Promise<IssueRow> {
  const rows = await supabaseRequest<IssueRow[]>(`issues?id=eq.${encodeURIComponent(issueId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ blocks, updated_at: new Date().toISOString() }),
  })
  if (!rows[0]) throw new Error('Issue not found.')
  return rows[0]
}

function articleCount(blocks: NotionBlock[]) {
  return blocks.filter(block => block.type === 'heading_3').length
}

export async function appendArticleToIssue(issue: IssueTarget, article: CaptureArticleInput): Promise<CaptureResult> {
  const row = await getIssueRowById(issue.issueId)
  if (!row) throw new Error('Issue not found.')
  const blocksToAppend = [
    h3(article.title),
    ...(article.publishedDate ? [paragraph(`Published: ${article.publishedDate}`)] : []),
    paragraph(article.annotation),
    bookmark(article.url),
    ...(article.imageUrl ? [image(article.imageUrl)] : []),
    divider(),
  ]
  const blocks = insertIntoSection(row.blocks ?? [], article.category?.trim() || null, blocksToAppend)
  const updated = await updateIssueBlocks(issue.issueId, blocks)
  return {
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount: articleCount(updated.blocks ?? []),
  }
}

export async function captureArticleToTodaysDraft(article: CaptureArticleInput): Promise<CaptureResult> {
  const issue = await findOrCreateTodaysDraft()
  return appendArticleToIssue(issue, article)
}

export async function captureArticleToIssue(issueId: string, article: CaptureArticleInput): Promise<CaptureResult> {
  const issue = await getIssueTargetById(issueId)
  if (!issue) throw new Error('Issue not found.')
  return appendArticleToIssue(issue, article)
}

const EVENTS_CATEGORY = 'Upcoming'

export async function appendEventToIssue(issue: IssueTarget, event: CaptureEventInput): Promise<CaptureResult> {
  const row = await getIssueRowById(issue.issueId)
  if (!row) throw new Error('Issue not found.')
  const metaParts = []
  if (event.when.trim()) metaParts.push(`When: ${event.when.trim()}`)
  if (event.where.trim()) metaParts.push(`Where: ${event.where.trim()}`)
  const metaLine = metaParts.join(' - ')
  const blocksToAppend = [
    h3(event.title),
    ...(metaLine ? [paragraph(metaLine)] : []),
    ...(event.description?.trim() ? [paragraph(event.description.trim())] : []),
    bookmark(event.url),
    divider(),
  ]
  const blocks = insertIntoSection(row.blocks ?? [], EVENTS_CATEGORY, blocksToAppend)
  const updated = await updateIssueBlocks(issue.issueId, blocks)
  return {
    issueId: issue.issueId,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount: articleCount(updated.blocks ?? []),
  }
}

export async function captureEventToTodaysDraft(event: CaptureEventInput): Promise<CaptureResult> {
  const issue = await findOrCreateTodaysDraft()
  return appendEventToIssue(issue, event)
}

export async function captureEventToIssue(issueId: string, event: CaptureEventInput): Promise<CaptureResult> {
  const issue = await getIssueTargetById(issueId)
  if (!issue) throw new Error('Issue not found.')
  return appendEventToIssue(issue, event)
}

export async function publishIssue(issueId: string, options: { summary?: string } = {}): Promise<Issue> {
  const now = new Date().toISOString()
  const body: {
    published: boolean
    published_at: string
    updated_at: string
    summary?: string
  } = { published: true, published_at: now, updated_at: now }

  const summary = options.summary?.trim()
  if (summary) body.summary = summary

  const rows = await supabaseRequest<IssueRow[]>(`issues?id=eq.${encodeURIComponent(issueId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!rows[0]) throw new Error('Issue not found.')
  return mapIssue(rows[0])
}

export async function listDraftIssues(): Promise<Issue[]> {
  const params = new URLSearchParams({
    select: 'id,title,issue_date,issue_number,published,summary,ai_assisted,published_at,created_at,updated_at',
    published: 'eq.false',
    order: 'issue_date.desc',
  })
  const rows = await supabaseRequest<IssueRow[]>(`issues?${params.toString()}`)
  return rows.map(mapIssue).filter(issue => issue.issueNumber > 0)
}

export async function archiveIssue(issueId: string): Promise<void> {
  await supabaseRequest<void>(`issues?id=eq.${encodeURIComponent(issueId)}`, { method: 'DELETE' })
}

export async function listEditablePublishedIssueItems(issueId: string): Promise<EditablePublishedIssueItem[]> {
  const row = await getIssueRowById(issueId)
  if (!row) throw new Error('Issue not found.')
  const items: EditablePublishedIssueItem[] = []
  let section = 'Unsectioned'
  let current: EditablePublishedIssueItem | null = null

  const flush = () => {
    if (!current) return
    if (current.title.trim()) items.push(current)
    current = null
  }

  for (const block of row.blocks ?? []) {
    if (block.type === 'heading_2') {
      flush()
      section = block.content || 'Unsectioned'
      continue
    }

    if (block.type === 'heading_3') {
      flush()
      current = {
        id: block.id,
        section,
        title: block.content,
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
      current.sourceUrl = block.href ?? current.sourceUrl
      continue
    }

    if (block.type !== 'paragraph') continue
    const text = block.content.trim()
    if (!text) continue

    const sourceUrl = block.richText?.find(segment => segment.href)?.href
    if (sourceUrl && (text === sourceUrl || /^https?:\/\//i.test(text))) {
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

export async function updatePublishedIssueItem(
  issueId: string,
  itemId: string,
  update: { title: string; summary: string },
): Promise<EditablePublishedIssueItem> {
  const row = await getIssueRowById(issueId)
  if (!row) throw new Error('Issue not found.')
  const items = await listEditablePublishedIssueItems(issueId)
  const item = items.find(candidate => candidate.id === itemId)
  if (!item) throw new Error('Item not found in this issue.')

  const blocks = (row.blocks ?? []).map(block => {
    if (block.id === item.titleBlockId) return { ...block, content: update.title }
    if (item.summaryBlockId && block.id === item.summaryBlockId) {
      return { ...block, content: update.summary, richText: [{ text: update.summary }] }
    }
    return block
  })
  await updateIssueBlocks(issueId, blocks)
  return { ...item, title: update.title, summary: item.summaryBlockId ? update.summary : item.summary }
}

export async function removePublishedIssueItem(
  issueId: string,
  itemId: string,
): Promise<EditablePublishedIssueItem> {
  const row = await getIssueRowById(issueId)
  if (!row) throw new Error('Issue not found.')
  const items = await listEditablePublishedIssueItems(issueId)
  const item = items.find(candidate => candidate.id === itemId)
  if (!item) throw new Error('Item not found in this issue.')
  if (item.blockIds.length === 0) throw new Error('This item has no removable blocks.')
  const removeIds = new Set(item.blockIds)
  await updateIssueBlocks(issueId, (row.blocks ?? []).filter(block => !removeIds.has(block.id)))
  return item
}

export async function listAllIssues(days?: number): Promise<Array<Issue & { blocks: NotionBlock[] }>> {
  if (!isIssueStoreConfigured()) return []
  const params = new URLSearchParams({ select: '*', order: 'issue_date.desc' })
  if (days) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    params.set('issue_date', `gte.${cutoff.toISOString().slice(0, 10)}`)
  }
  const rows = await supabaseRequest<IssueRow[]>(`issues?${params.toString()}`)
  return rows.map(row => ({ ...mapIssue(row), blocks: row.blocks ?? [] }))
}

export async function buildKnownUrlMap(days = 30): Promise<Map<string, KnownUrlEntry>> {
  const { normalizeUrl } = await import('./url-normalize')
  const issues = await listAllIssues(days)
  const map = new Map<string, KnownUrlEntry>()
  for (const issue of issues) {
    for (const block of issue.blocks) {
      const url = block.type === 'bookmark' ? block.href : block.richText?.find(seg => seg.href)?.href
      const normalized = url ? normalizeUrl(url) : null
      if (normalized && !map.has(normalized)) {
        map.set(normalized, {
          pageId: issue.id,
          issueNumber: issue.issueNumber,
          issueDate: issue.issueDate,
          published: issue.published,
          title: issue.title,
          url: url ?? '',
        })
      }
    }
  }
  return map
}

export async function buildKnownTitleList(days = 30): Promise<KnownTitleEntry[]> {
  const issues = await listAllIssues(days)
  const titles: KnownTitleEntry[] = []
  for (const issue of issues) {
    for (const block of issue.blocks) {
      if (block.type === 'heading_3' && block.content.trim()) {
        titles.push({
          pageId: issue.id,
          issueNumber: issue.issueNumber,
          issueDate: issue.issueDate,
          published: issue.published,
          title: block.content.trim(),
        })
      }
    }
  }
  return titles
}
