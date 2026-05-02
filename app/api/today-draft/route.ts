import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DailyArticle {
  title: string | null
  annotation: string | null
  url: string | null
  imageUrl: string | null
  /** Notion block ID of the paragraph that holds the annotation. Used by
   *  the regenerate flow to update the annotation in place. May be null
   *  for very old articles that predate this field. */
  annotationBlockId: string | null
  /** Canonical category — populated from the most recent `heading_2`
   *  ("## Canada", "## AI Policy", etc.) preceding this article in the
   *  Notion draft. Null only for articles that appear before any heading. */
  category: string | null
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD
    const notionToken = process.env.NOTION_TOKEN
    const notionDatabaseId = process.env.NOTION_DATABASE_ID

    if (!adminPassword || !notionToken || !notionDatabaseId) {
      return NextResponse.json(
        { error: 'Server configuration error: missing environment variables.' },
        { status: 500 }
      )
    }

    const password = request.headers.get('x-admin-password')

    if (!password || password !== adminPassword) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
    }

    const today = new Date().toISOString().split('T')[0]
    const notion = new Client({ auth: notionToken })

    // Query for today's draft issue
    const response = await notion.databases.query({
      database_id: notionDatabaseId,
      filter: {
        and: [
          { property: 'Published', checkbox: { equals: false } },
          { property: 'Issue Date', date: { equals: today } },
        ],
      },
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

    // Fetch page blocks
    const blocksResponse = await notion.blocks.children.list({ block_id: pageId })

    // Parse articles from flat daily block structure
    const articles: DailyArticle[] = []
    let current: DailyArticle | null = null
    // Track the active category from the most recent heading_2 ("## Canada", etc.)
    let currentCategory: string | null = null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of blocksResponse.results as any[]) {
      const type: string = b.type

      if (type === 'heading_2') {
        // Finalize any in-flight article — section transition
        if (current) { articles.push(current); current = null }
        const text = (b.heading_2.rich_text as { plain_text: string }[])
          .map((r) => r.plain_text)
          .join('')
          .trim()
        currentCategory = text || null
      } else if (type === 'heading_3') {
        // Finalize previous article before starting new one
        if (current) articles.push(current)
        const text = (b.heading_3.rich_text as { plain_text: string }[])
          .map((r) => r.plain_text)
          .join('')
        current = { title: text, annotation: null, url: null, imageUrl: null, annotationBlockId: null, category: currentCategory }
      } else if (type === 'paragraph' && current) {
        const text = (b.paragraph.rich_text as { plain_text: string }[])
          .map((r) => r.plain_text)
          .join('')
        // Skip "Published: ..." metadata lines
        if (text && !text.startsWith('Published:')) {
          current.annotation = text
          current.annotationBlockId = b.id ?? null
        }
      } else if (type === 'bookmark' && current) {
        current.url = b.bookmark.url ?? null
        // Note: don't finalize on bookmark. The capture flow appends an
        // optional image block AFTER the bookmark, so finalizing here would
        // drop the image. Only divider closes an article.
      } else if (type === 'image' && current) {
        current.imageUrl = b.image.external?.url ?? b.image.file?.url ?? null
      } else if (type === 'divider') {
        if (current) {
          articles.push(current)
          current = null
        }
      }
    }

    // Finalize any trailing article
    if (current) articles.push(current)

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
