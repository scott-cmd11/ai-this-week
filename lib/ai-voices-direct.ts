import { CATEGORY_META, type Category } from './category-mapping'

export interface AiVoicesSource {
  key: string
  publication: string
  primaryFeed: string
  fallbackFeed?: string
  category: Category
}

export interface AiVoicesArticle {
  title: string
  url: string
  summary: string
  source: string
  publishedDate: string | null
  category: Category
  maxAgeDays: number
}

export const AI_VOICES_SOURCES: AiVoicesSource[] = [
  {
    key: 'import_ai',
    publication: 'Import AI',
    primaryFeed: 'https://jack-clark.net/feed/',
    fallbackFeed: 'https://importai.substack.com/feed',
    category: 'Industry & Models',
  },
  {
    key: 'planned_obsolescence',
    publication: 'Planned Obsolescence',
    primaryFeed: 'https://www.planned-obsolescence.org/feed',
    fallbackFeed: 'https://plannedobs.substack.com/feed',
    category: 'Industry & Models',
  },
  {
    key: 'one_useful_thing',
    publication: 'One Useful Thing',
    primaryFeed: 'https://www.oneusefulthing.org/feed',
    category: 'Sectors & Applications',
  },
  {
    key: 'lifearchitect',
    publication: 'LifeArchitect.ai',
    primaryFeed: 'https://lifearchitect.substack.com/feed',
    category: 'Industry & Models',
  },
  {
    key: 'epoch_ai',
    publication: 'Epoch AI',
    primaryFeed: 'https://epochai.substack.com/feed',
    category: 'Research',
  },
  {
    key: 'metr',
    publication: 'METR',
    primaryFeed: 'https://metr.org/feed.xml',
    fallbackFeed: 'https://metr.substack.com/feed',
    category: 'Research',
  },
]

interface ParsedFeedItem {
  title: string
  url: string
  summary: string
  publishedDate: string | null
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
}

function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]).trim() : ''
}

function atomLink(entry: string): string {
  const alternate = entry.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i)
  const first = entry.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)
  return decodeXml(alternate?.[1] ?? first?.[1] ?? '').trim()
}

function normaliseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || ['ref', 's'].includes(key.toLowerCase())) {
        parsed.searchParams.delete(key)
      }
    }
    return parsed.href
  } catch {
    return url.trim()
  }
}

export function formatFeedDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseRssItems(xml: string): ParsedFeedItem[] {
  const itemMatches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
  return itemMatches.map(match => {
    const item = match[1]
    return {
      title: stripHtml(tagText(item, 'title')),
      url: normaliseUrl(stripHtml(tagText(item, 'link'))),
      summary: stripHtml(tagText(item, 'description') || tagText(item, 'content:encoded')),
      publishedDate: formatFeedDate(tagText(item, 'pubDate') || tagText(item, 'dc:date')),
    }
  })
}

function parseAtomItems(xml: string): ParsedFeedItem[] {
  const entryMatches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)]
  return entryMatches.map(match => {
    const entry = match[1]
    return {
      title: stripHtml(tagText(entry, 'title')),
      url: normaliseUrl(atomLink(entry)),
      summary: stripHtml(tagText(entry, 'summary') || tagText(entry, 'content')),
      publishedDate: formatFeedDate(tagText(entry, 'published') || tagText(entry, 'updated')),
    }
  })
}

export function parseAiVoicesFeed(source: AiVoicesSource, xml: string): AiVoicesArticle[] {
  const parsed = xml.includes('<entry') ? parseAtomItems(xml) : parseRssItems(xml)
  return parsed
    .filter(item => item.title && item.url.startsWith('http') && !item.title.startsWith('http'))
    .map(item => ({
      title: item.title,
      url: item.url,
      summary: item.summary || `${item.title} from ${source.publication}.`,
      source: source.publication,
      publishedDate: item.publishedDate,
      category: source.category,
      maxAgeDays: source.category === 'Research' ? 14 : 7,
    }))
}

function dateWithinWindow(publishedDate: string | null, issueDate: string, maxAgeDays: number): boolean {
  if (!publishedDate) return true
  const published = new Date(publishedDate)
  const issue = new Date(`${issueDate}T12:00:00Z`)
  if (Number.isNaN(published.getTime()) || Number.isNaN(issue.getTime())) return true
  const cutoff = new Date(issue)
  cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays)
  return published >= cutoff && published <= issue
}

function scoreArticle(article: AiVoicesArticle): number {
  const text = `${article.title} ${article.summary} ${article.source}`.toLowerCase()
  let score = 0
  if (text.includes('agent') || text.includes('model') || text.includes('benchmark')) score += 4
  if (text.includes('safety') || text.includes('risk') || text.includes('evaluation')) score += 4
  if (text.includes('policy') || text.includes('governance') || text.includes('public sector')) score += 3
  if (text.includes('canada') || text.includes('canadian')) score += 3
  if (article.category === 'Research') score += 2
  if (CATEGORY_META[article.category]) score += 1
  return score
}

export function selectAiVoicesArticles(articles: AiVoicesArticle[], issueDate: string, limit = 12): AiVoicesArticle[] {
  const seen = new Set<string>()
  const unique = articles.filter(article => {
    const key = normaliseUrl(article.url)
    if (seen.has(key)) return false
    seen.add(key)
    return dateWithinWindow(article.publishedDate, issueDate, article.maxAgeDays)
  })

  return unique
    .sort((a, b) => scoreArticle(b) - scoreArticle(a) || a.title.localeCompare(b.title))
    .slice(0, limit)
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Today/1.0)',
      },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

export async function fetchAiVoicesArticles(issueDate: string, limit = 12): Promise<AiVoicesArticle[]> {
  const collected: AiVoicesArticle[] = []
  for (const source of AI_VOICES_SOURCES) {
    const primary = await fetchFeed(source.primaryFeed)
    const fallback = primary ? null : source.fallbackFeed ? await fetchFeed(source.fallbackFeed) : null
    const xml = primary ?? fallback
    if (!xml) continue
    collected.push(...parseAiVoicesFeed(source, xml))
  }
  return selectAiVoicesArticles(collected, issueDate, limit)
}
