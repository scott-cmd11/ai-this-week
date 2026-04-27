import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ResearchPaper {
  id: string
  title: string
  summary: string | null       // Plain Summary — already readable prose
  keyFindings: string | null   // Key Findings — bullet-point highlights
  url: string | null           // Primary link: arXiv abstract > PDF Link > HF Link
  pdfUrl: string | null
  hfUrl: string | null
  area: string[]               // e.g. ["LLMs", "Agents"]
  authors: string | null
  source: string | null        // "arXiv" | "Hugging Face" | "Both"
  arXivId: string | null
  date: string | null          // YYYY-MM-DD from the Date property
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function todayUtc(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const notionToken = process.env.NOTION_TOKEN
  const notionResearchDbId = process.env.NOTION_RESEARCH_DB_ID

  if (!adminPassword || !notionToken) {
    return NextResponse.json(
      { error: 'Server configuration error: missing environment variables.' },
      { status: 500 },
    )
  }

  if (!notionResearchDbId) {
    // Not configured — return a signal so the admin panel can hide itself
    return NextResponse.json({ papers: [], date: todayUtc(), configured: false })
  }

  const password = request.nextUrl.searchParams.get('password')
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date') ?? todayUtc()
  const notion = new Client({ auth: notionToken })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion.databases.query({
      database_id: notionResearchDbId,
      filter: {
        property: 'Date',
        date: { equals: date },
      },
      // Most-recently-added first (Notion default is creation order)
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 50,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const papers: ResearchPaper[] = (response.results ?? []).flatMap((page: any) => {
      if (page.object !== 'page' || !('properties' in page)) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props: Record<string, any> = page.properties

      const title = props['Title']?.type === 'title'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['Title'].title.map((t: any) => t.plain_text ?? '').join('').trim()
        : ''
      if (!title) return []

      const rawSummary = props['Plain Summary']?.type === 'rich_text'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['Plain Summary'].rich_text.map((t: any) => t.plain_text ?? '').join('').trim()
        : ''
      // Strip any markdown heading prefix the automation may have injected
      // e.g. "### Plain Summary\n..." or "### Plain Summary:\n..."
      const summary = rawSummary
        .replace(/^#{1,4}\s*plain summary:?\s*/i, '')
        .trim() || null

      const keyFindings = props['Key Findings']?.type === 'rich_text'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['Key Findings'].rich_text.map((t: any) => t.plain_text ?? '').join('').trim() || null
        : null

      const pdfUrl = props['PDF Link']?.type === 'url' ? (props['PDF Link'].url as string | null) : null
      const hfUrl = props['HF Link']?.type === 'url' ? (props['HF Link'].url as string | null) : null
      const arXivId = props['arXiv ID']?.type === 'rich_text'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['arXiv ID'].rich_text.map((t: any) => t.plain_text ?? '').join('').trim() || null
        : null

      const area: string[] = props['Area']?.type === 'multi_select'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['Area'].multi_select.map((o: any) => o.name as string)
        : []

      const authors = props['Authors']?.type === 'rich_text'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? props['Authors'].rich_text.map((t: any) => t.plain_text ?? '').join('').trim() || null
        : null

      const source = props['Source']?.type === 'select'
        ? (props['Source'].select?.name ?? null) as string | null
        : null

      const paperDate = props['Date']?.type === 'date'
        ? (props['Date'].date?.start ?? null) as string | null
        : null

      // Primary URL: arXiv abstract page (stable, citable) > PDF Link > HF Link
      const url = arXivId
        ? `https://arxiv.org/abs/${arXivId}`
        : (pdfUrl ?? hfUrl)

      if (!url) return []

      return [{ id: page.id, title, summary, keyFindings, url, pdfUrl, hfUrl, area, authors, source, arXivId, date: paperDate }]
    })

    return NextResponse.json({ papers, date, configured: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
