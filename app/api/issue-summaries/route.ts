import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

type SectionKey = 'top' | 'bright' | 'tool' | 'podcast' | 'learning' | 'deep'

interface SectionSummary {
  url: string
  title: string | null
  summary: string
  publishedDate: string | null
}

// Maps heading_2 text → section key
const SECTION_HEADING_MAP: [string, SectionKey][] = [
  ['top stories', 'top'],
  ['bright spot', 'bright'],
  ['tool of the week', 'tool'],
  ['podcast of the week', 'podcast'],
  ['learning', 'learning'],
  ['deep dive', 'deep'],
]

function detectSection(text: string): SectionKey | null {
  const lower = text.toLowerCase()
  for (const [keyword, key] of SECTION_HEADING_MAP) {
    if (lower.includes(keyword)) return key
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(richText: any[]): string {
  return (richText ?? []).map((r: { plain_text?: string }) => r.plain_text ?? '').join('')
}

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN

  if (!adminPassword || !notionToken) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const password = searchParams.get('password')
  const pageId = searchParams.get('pageId')

  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }
  if (!pageId) {
    return NextResponse.json({ error: 'Missing pageId.' }, { status: 400 })
  }

  const notion = new Client({ auth: notionToken })

  // Fetch page properties for issue number and date
  const page = await notion.pages.retrieve({ page_id: pageId })
  let issueNumber = 0
  let issueDate = ''
  if (page.object === 'page' && 'properties' in page) {
    const props = page.properties
    if (props['Issue Number']?.type === 'number') issueNumber = props['Issue Number'].number ?? 0
    if (props['Issue Date']?.type === 'date') issueDate = props['Issue Date'].date?.start ?? ''
  }

  // Fetch all blocks (paginated)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allBlocks: any[] = []
  let cursor: string | undefined = undefined
  do {
    const resp = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    allBlocks.push(...resp.results)
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined
  } while (cursor)

  // Parse blocks into summaries using a linear state machine.
  // Block order written by new-issue: h2 (section) → h3 (title) → paragraph (published date / summary) → bookmark (url)
  const summaries: Record<SectionKey, SectionSummary[]> = {
    top: [], bright: [], tool: [], podcast: [], learning: [], deep: [],
  }

  let currentSection: SectionKey | null = null
  let current: { title: string | null; publishedDate: string | null; summary: string | null; url: string | null } | null = null

  function finalizeArticle() {
    if (currentSection && current?.url && current.summary) {
      summaries[currentSection].push({
        url: current.url,
        title: current.title,
        summary: current.summary,
        publishedDate: current.publishedDate ?? null,
      })
    }
    current = null
  }

  for (const rawBlock of allBlocks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = rawBlock as any

    if (b.type === 'heading_2') {
      finalizeArticle()
      currentSection = detectSection(extractText(b.heading_2.rich_text))

    } else if (b.type === 'heading_3') {
      finalizeArticle()
      current = { title: extractText(b.heading_3.rich_text) || null, publishedDate: null, summary: null, url: null }

    } else if (b.type === 'paragraph' && current) {
      const text = extractText(b.paragraph.rich_text)
      if (text.startsWith('Published: ')) {
        current.publishedDate = text.slice('Published: '.length)
      } else if (text.startsWith('🔹 ')) {
        // Top Stories summaries are prefixed with 🔹
        current.summary = text.slice('🔹 '.length)
      } else if (text && !text.startsWith('⚠️') && !current.summary) {
        // Single-section items (bright, tool, etc.) have no prefix
        current.summary = text
      }

    } else if (b.type === 'bookmark' && current) {
      current.url = b.bookmark.url
      finalizeArticle()

    } else if (b.type === 'divider') {
      finalizeArticle()
    }
  }

  finalizeArticle()

  return NextResponse.json({ summaries, issueNumber, issueDate })
}
