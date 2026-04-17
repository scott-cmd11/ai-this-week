import { getPublishedIssues } from '@/lib/notion'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aithisweek.com'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isoToRfc2822(isoDate: string): string {
  // e.g. "2024-01-15" → RFC 2822 date
  return new Date(isoDate + 'T12:00:00Z').toUTCString()
}

export async function GET() {
  const issues = await getPublishedIssues()

  const items = issues
    .map(issue => {
      const link = `${SITE_URL}/issues/${issue.slug}`
      const pubDate = isoToRfc2822(issue.issueDate)
      const description = issue.summary ? escapeXml(issue.summary) : ''
      return `
    <item>
      <title>${escapeXml(issue.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      ${description ? `<description>${description}</description>` : ''}
    </item>`
    })
    .join('')

  const lastBuildDate = issues.length > 0 ? isoToRfc2822(issues[0].issueDate) : new Date().toUTCString()

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI This Week</title>
    <link>${SITE_URL}</link>
    <description>The most important stories in artificial intelligence — for professional, non-technical readers. No hype, no jargon.</description>
    <language>en-gb</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=300, stale-while-revalidate',
    },
  })
}
