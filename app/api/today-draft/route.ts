import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'
import { parseDailyArticles } from '@/lib/draft-articles'
import { issueDateFor } from '@/lib/issue-date'

export async function GET(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    const notionToken = process.env.NOTION_TOKEN
    const notionDatabaseId = process.env.NOTION_DATABASE_ID

    if (!adminPassword || !notionToken || !notionDatabaseId) {
      return NextResponse.json(
        { error: 'Server configuration error: missing environment variables.' },
        { status: 500 },
      )
    }

    const password = request.headers.get('x-admin-password')
    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const today = issueDateFor()
    const notion = new Client({ auth: notionToken })

    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        and: [
          { property: 'Published', checkbox: { equals: false } },
          { property: 'Issue Date', date: { equals: today } },
        ],
      },
      page_size: 1,
    })

    if (response.results.length === 0) {
      return NextResponse.json({ draft: null, articles: [], articleCount: 0 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = response.results[0] as any
    const props = page.properties
    const pageId: string = page.id
    const issueNumber: number = props['Issue Number']?.number ?? 0
    const issueDate: string = props['Issue Date']?.date?.start ?? today
    const title: string = props['Title']?.title?.[0]?.plain_text ?? ''

    // Notion returns child blocks in pages. A full daily issue can exceed 100
    // blocks once headings, paragraphs, bookmarks, images, and dividers stack up.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allBlocks: any[] = []
    let cursor: string | undefined
    do {
      const blocksResponse = await notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      })
      allBlocks.push(...blocksResponse.results)
      cursor = blocksResponse.has_more ? blocksResponse.next_cursor ?? undefined : undefined
    } while (cursor)

    const articles = parseDailyArticles(allBlocks)

    return NextResponse.json({
      draft: { id: pageId, issueNumber, issueDate, title },
      articles,
      articleCount: articles.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
