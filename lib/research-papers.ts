import { Client } from '@notionhq/client'

export interface ResearchPaper {
  id: string
  title: string
  summary: string | null
  keyFindings: string | null
  url: string | null
  pdfUrl: string | null
  hfUrl: string | null
  area: string[]
  authors: string | null
  source: string | null
  arXivId: string | null
  date: string | null
  databaseId: string
}

export async function fetchResearchPapersForDate(
  notion: Client,
  configuredDatabaseId: string | undefined,
  date: string,
): Promise<{ papers: ResearchPaper[]; databaseIdsChecked: string[] }> {
  const databaseIds = await resolveResearchDatabaseIds(notion, configuredDatabaseId)
  const allPapers: ResearchPaper[] = []
  const seen = new Set<string>()

  for (const databaseId of databaseIds) {
    const papers = await queryResearchDatabase(notion, databaseId, date)
    for (const paper of papers) {
      const key = paper.url ?? paper.title
      if (seen.has(key)) continue
      seen.add(key)
      allPapers.push(paper)
    }
  }

  return { papers: allPapers, databaseIdsChecked: databaseIds }
}

async function resolveResearchDatabaseIds(
  notion: Client,
  configuredDatabaseId: string | undefined,
): Promise<string[]> {
  const ids: string[] = []
  if (configuredDatabaseId?.trim()) ids.push(configuredDatabaseId.trim())

  try {
    const search = await notion.search({
      query: 'AI Research Papers',
      page_size: 10,
      filter: { property: 'object', value: 'database' },
    })

    for (const item of search.results) {
      if (item.object !== 'database') continue
      const title = 'title' in item
        ? item.title.map(part => part.plain_text).join('').trim()
        : ''
      if (/AI Research Papers/i.test(title)) ids.push(item.id)
    }
  } catch {
    // Search is best-effort. The configured DB remains the primary source.
  }

  return [...new Set(ids)]
}

async function queryResearchDatabase(
  notion: Client,
  databaseId: string,
  date: string,
): Promise<ResearchPaper[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Date',
        date: { equals: date },
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 50,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.results ?? []).flatMap((page: any) => mapResearchPage(page, databaseId))
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapResearchPage(page: any, databaseId: string): ResearchPaper[] {
  if (page.object !== 'page' || !('properties' in page)) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = page.properties

  const title = props['Title']?.type === 'title'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Title'].title.map((text: any) => text.plain_text ?? '').join('').trim()
    : ''
  if (!title) return []

  const rawSummary = props['Plain Summary']?.type === 'rich_text'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Plain Summary'].rich_text.map((text: any) => text.plain_text ?? '').join('').trim()
    : ''
  const summary = rawSummary.replace(/^#{1,4}\s*plain summary:?\s*/i, '').trim() || null

  const keyFindings = props['Key Findings']?.type === 'rich_text'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Key Findings'].rich_text.map((text: any) => text.plain_text ?? '').join('').trim() || null
    : null

  const pdfUrl = props['PDF Link']?.type === 'url' ? (props['PDF Link'].url as string | null) : null
  const hfUrl = props['HF Link']?.type === 'url' ? (props['HF Link'].url as string | null) : null
  const arXivId = props['arXiv ID']?.type === 'rich_text'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['arXiv ID'].rich_text.map((text: any) => text.plain_text ?? '').join('').trim() || null
    : null

  const area: string[] = props['Area']?.type === 'multi_select'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Area'].multi_select.map((option: any) => option.name as string)
    : []

  const authors = props['Authors']?.type === 'rich_text'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? props['Authors'].rich_text.map((text: any) => text.plain_text ?? '').join('').trim() || null
    : null

  const source = props['Source']?.type === 'select'
    ? (props['Source'].select?.name ?? null) as string | null
    : null

  const paperDate = props['Date']?.type === 'date'
    ? (props['Date'].date?.start ?? null) as string | null
    : null

  const url = arXivId
    ? `https://arxiv.org/abs/${arXivId}`
    : (pdfUrl ?? hfUrl)

  if (!url) return []

  return [{
    id: page.id,
    title,
    summary,
    keyFindings,
    url,
    pdfUrl,
    hfUrl,
    area,
    authors,
    source,
    arXivId,
    date: paperDate,
    databaseId,
  }]
}
