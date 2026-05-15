export interface RssItem {
  title: string
  link: string
  sourceName: string | null
  sourceUrl: string | null
  publishedAt: string | null
  description: string
}

export function parseRssItems(xml: string): RssItem[] {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  const entryMatches = itemMatches.length > 0 ? itemMatches : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
  return entryMatches.map(match => {
    const item = match[0]
    const source = readSource(item)
    const link = readTag(item, 'link') || readAtomLink(item)
    const title = cleanRssTitle(decodeXml(readTag(item, 'title')), source.name)
    return {
      title,
      link: decodeXml(link),
      sourceName: source.name,
      sourceUrl: source.url,
      publishedAt: normalizeRssDate(readTag(item, 'pubDate') || readTag(item, 'published') || readTag(item, 'updated')),
      description: stripHtml(decodeXml(readTag(item, 'description') || readTag(item, 'summary') || readTag(item, 'content:encoded'))),
    }
  }).filter(item => item.title && item.link)
}

function readSource(xml: string): { name: string | null; url: string | null } {
  const match = xml.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i)
  if (!match) return { name: null, url: null }
  const attrs = match[1] ?? ''
  return {
    name: decodeXml(match[2] ?? '').trim() || null,
    url: decodeXml(attrs.match(/\burl=["']([^"']+)["']/i)?.[1] ?? '').trim() || null,
  }
}

function readTag(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
  return match?.[1]?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() ?? ''
}

function readAtomLink(xml: string): string {
  const href = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
  return href?.trim() ?? ''
}

function normalizeRssDate(value: string): string | null {
  if (!value) return null
  const parsed = new Date(decodeXml(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanRssTitle(title: string, sourceName: string | null): string {
  if (!sourceName) return title
  const suffix = ` - ${sourceName}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title
}
