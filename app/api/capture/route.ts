import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import OpenAI from 'openai'
import { fetchArticle, hostnameFallback } from '@/lib/article-fetcher'
import { block, richText, formatIsoDate } from '@/lib/notion-blocks'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RequestBody {
  token?: string
  adminPassword?: string
  url: string
  annotation?: string
  autoAnnotate?: boolean
  imageUrl?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

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

// ─── Route handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const captureToken = process.env.CAPTURE_TOKEN
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionDatabaseId = process.env.NOTION_DATABASE_ID
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!captureToken || !notionToken || !notionDatabaseId || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error: missing environment variables.' }, { status: 500 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Auth: accept either CAPTURE_TOKEN or ADMIN_PASSWORD
  const tokenOk = body.token && body.token === captureToken
  const adminOk = body.adminPassword && adminPassword && body.adminPassword === adminPassword
  if (!tokenOk && !adminOk) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Validate URL
  if (!body.url || !body.url.startsWith('http')) {
    return NextResponse.json({ error: 'Missing or invalid URL.' }, { status: 400 })
  }

  const { url, annotation, autoAnnotate = true, imageUrl: imageUrlOverride } = body

  const notion = new Client({ auth: notionToken })
  const openai = new OpenAI({ apiKey: openaiApiKey })

  try {
    // Step 1: Get today's date in UTC
    const today = new Date().toISOString().split('T')[0]

    // Step 2: Query for an existing draft for today
    const draftQuery = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        and: [
          { property: 'Published', checkbox: { equals: false } },
          { property: 'Issue Date', date: { equals: today } },
        ],
      },
      page_size: 1,
    })

    let issueId: string
    let issueNumber: number

    if (draftQuery.results.length > 0) {
      // Use existing draft
      const existing = draftQuery.results[0]
      issueId = existing.id
      if (existing.object === 'page' && 'properties' in existing) {
        const prop = existing.properties['Issue Number']
        issueNumber = prop?.type === 'number' ? (prop.number ?? 0) : 0
      } else {
        issueNumber = 0
      }
    } else {
      // Create a new draft for today
      issueNumber = await getNextIssueNumber(notion, notionDatabaseId)
      const title = `AI Today — ${formatIsoDate(today)}`

      const newPage = await notion.pages.create({
        parent: { database_id: notionDatabaseId },
        properties: {
          Title: { title: richText(title) },
          'Issue Date': { date: { start: today } },
          'Issue Number': { number: issueNumber },
          Published: { checkbox: false },
          'AI Assisted': { checkbox: true },
        },
      })

      issueId = newPage.id
    }

    // Step 3: Fetch article metadata
    const fetchResult = await fetchArticle(url)
    const { title, text } = fetchResult
    const fetchedImageUrl = fetchResult.imageUrl

    // Step 4: Determine annotation
    let resolvedAnnotation: string

    if (annotation) {
      resolvedAnnotation = annotation
    } else if (autoAnnotate !== false) {
      try {
        const articleText = text ? text.slice(0, 3000) : ''
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Write a 1-2 sentence annotation for this article as it would appear in an AI newsletter for non-technical professionals. Be specific about what's interesting or significant. Plain text only, no bullet points.\n\nTitle: ${title ?? hostnameFallback(url)}\nURL: ${url}\n\nArticle text:\n${articleText}`,
            },
          ],
        })
        resolvedAnnotation =
          response.choices[0]?.message?.content?.trim() ?? '[Add annotation]'
      } catch {
        resolvedAnnotation = '[Add annotation]'
      }
    } else {
      resolvedAnnotation = '[Add annotation]'
    }

    // Step 5: Append blocks to the draft page
    const effectiveImageUrl = imageUrlOverride ?? fetchedImageUrl ?? null

    const blocksToAppend = [
      block.h3(title || hostnameFallback(url)),
      block.paragraph(resolvedAnnotation),
      block.bookmark(url),
      ...(effectiveImageUrl ? [block.image(effectiveImageUrl)] : []),
      block.divider(),
    ]

    await notion.blocks.children.append({
      block_id: issueId,
      children: blocksToAppend,
    })

    // Step 6: Count h3 blocks to get article count
    const allBlocks = await notion.blocks.children.list({ block_id: issueId, page_size: 100 })
    const articleCount = allBlocks.results.filter(
      b => 'type' in b && b.type === 'heading_3'
    ).length

    return NextResponse.json({
      success: true,
      title: title ?? hostnameFallback(url),
      issueId,
      issueNumber,
      issueDate: today,
      articleCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
