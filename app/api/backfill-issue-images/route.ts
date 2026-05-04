import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { fetchArticleMeta } from '@/lib/article-fetcher'

interface RequestBody {
  adminPassword?: string
  date?: string
  dryRun?: boolean
}

interface Candidate {
  title: string
  url: string
  afterBlockId: string
  existingImage: boolean
  existingPublishedDate: boolean
}

interface BackfillResult {
  title: string
  url: string
  imageUrl: string | null
  publishedDate: string | null
  updated: boolean
  skippedReason?: string
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID

  if (!adminPassword || !notionToken || !notionDatabaseId) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  const dryRun = body.dryRun !== false
  const notion = new Client({ auth: notionToken })

  const issue = await notion.databases.query({
    database_id: notionDatabaseId,
    filter: {
      and: [
        { property: 'Issue Date', date: { equals: body.date } },
        { property: 'Published', checkbox: { equals: true } },
      ],
    },
    page_size: 1,
  })

  if (issue.results.length === 0) {
    return NextResponse.json({ error: `No published issue found for ${body.date}.` }, { status: 404 })
  }

  const page = issue.results[0]
  const blocks = await getAllChildBlocks(notion, page.id)
  const candidates = findMissingImageCandidates(blocks)
  const results: BackfillResult[] = []

  for (const candidate of candidates) {
    if (candidate.existingImage && candidate.existingPublishedDate) {
      results.push({
        title: candidate.title,
        url: candidate.url,
        imageUrl: null,
        publishedDate: null,
        updated: false,
        skippedReason: 'already has image and published date',
      })
      continue
    }

    const meta = await fetchArticleMeta(candidate.url)
    const shouldAddImage = !candidate.existingImage && Boolean(meta.imageUrl)
    const shouldAddPublishedDate = !candidate.existingPublishedDate && Boolean(meta.publishedDate)

    if (!shouldAddImage && !shouldAddPublishedDate) {
      results.push({
        title: candidate.title,
        url: candidate.url,
        imageUrl: meta.imageUrl,
        publishedDate: meta.publishedDate,
        updated: false,
        skippedReason: 'no new publisher metadata found',
      })
      continue
    }

    if (!dryRun) {
      await notion.blocks.children.append({
        block_id: page.id,
        after: candidate.afterBlockId,
        children: [
          ...(shouldAddPublishedDate ? [{
            object: 'block' as const,
            type: 'paragraph' as const,
            paragraph: {
              rich_text: [{
                type: 'text' as const,
                text: { content: `Published: ${meta.publishedDate}` },
              }],
            },
          }] : []),
          ...(shouldAddImage ? [{
            object: 'block' as const,
            type: 'image' as const,
            image: { type: 'external' as const, external: { url: meta.imageUrl! } },
          }] : []),
        ],
      })
    }

    results.push({
      title: candidate.title,
      url: candidate.url,
      imageUrl: meta.imageUrl,
      publishedDate: meta.publishedDate,
      updated: !dryRun,
    })
  }

  return NextResponse.json({
    date: body.date,
    dryRun,
    scanned: candidates.length,
    foundImages: results.filter(r => r.imageUrl).length,
    foundPublishedDates: results.filter(r => r.publishedDate).length,
    updated: results.filter(r => r.updated).length,
    results,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAllChildBlocks(notion: Client, blockId: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = []
  let cursor: string | undefined

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    })
    blocks.push(...response.results)
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined
  } while (cursor)

  return blocks
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findMissingImageCandidates(blocks: any[]): Candidate[] {
  const candidates: Candidate[] = []
  let currentTitle = ''
  let currentHasPublishedDate = false
  let pending: Candidate | null = null

  const flush = () => {
    if (pending) candidates.push(pending)
    pending = null
  }

  for (const block of blocks) {
    if (block.type === 'heading_3') {
      flush()
      currentTitle = plainText(block.heading_3?.rich_text) || 'Untitled story'
      currentHasPublishedDate = false
      continue
    }

    if (block.type === 'paragraph' && currentTitle) {
      const text = plainText(block.paragraph?.rich_text)
      if (text.startsWith('Published:')) {
        currentHasPublishedDate = true
        if (pending) pending.existingPublishedDate = true
        continue
      }
    }

    if (block.type === 'bookmark' && block.bookmark?.url && currentTitle) {
      flush()
      pending = {
        title: currentTitle,
        url: block.bookmark.url,
        afterBlockId: block.id,
        existingImage: false,
        existingPublishedDate: currentHasPublishedDate,
      }
      continue
    }

    if (block.type === 'paragraph' && currentTitle) {
      const url = firstLinkedHref(block.paragraph?.rich_text)
      if (url && isSourceParagraph(block.paragraph?.rich_text, url)) {
        flush()
        pending = {
          title: currentTitle,
          url,
          afterBlockId: block.id,
          existingImage: false,
          existingPublishedDate: currentHasPublishedDate,
        }
        continue
      }
    }

    if (block.type === 'image' && pending) {
      pending.existingImage = true
      continue
    }

    if (block.type === 'divider' || block.type === 'heading_2') {
      flush()
      if (block.type === 'heading_2') {
        currentTitle = ''
        currentHasPublishedDate = false
      }
    }
  }

  flush()
  return candidates
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plainText(richText: any[] | undefined): string {
  return richText?.map(item => item?.plain_text ?? '').join('').trim() ?? ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstLinkedHref(richText: any[] | undefined): string | null {
  const href = richText?.find(item => item?.href)?.href
  return typeof href === 'string' && href.startsWith('http') ? href : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSourceParagraph(richText: any[] | undefined, href: string): boolean {
  const text = plainText(richText)
  return text === href || /^https?:\/\//i.test(text)
}
