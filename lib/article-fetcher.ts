import { createRequire } from 'module'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface FetchResult {
  text: string | null
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}

export const DEFAULT_MAX_ARTICLE_AGE_DAYS = 2

// ─── HTML extraction helpers ─────────────────────────────────────────────────────

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function absolutizeUrl(candidate: string | null | undefined, pageUrl?: string): string | null {
  if (!candidate) return null
  const clean = decodeHtmlAttribute(candidate)
  if (!clean || clean.startsWith('data:')) return null
  try {
    return pageUrl ? new URL(clean, pageUrl).href : new URL(clean).href
  } catch {
    return null
  }
}

export function parsePublishedDateText(value: string | null | undefined): Date | null {
  if (!value) return null
  const cleaned = value.replace(/^Published:\s*/i, '').trim()
  if (!cleaned) return null

  const direct = new Date(cleaned)
  if (!Number.isNaN(direct.getTime())) {
    return new Date(Date.UTC(direct.getUTCFullYear(), direct.getUTCMonth(), direct.getUTCDate(), 12))
  }

  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/)
  if (!match) return null

  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }
  const month = months[match[2].toLowerCase()]
  if (month === undefined) return null

  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12))
}

export function isPublishedDateFreshForIssue(
  publishedDate: string | null | undefined,
  issueDate: string,
  maxAgeDays = DEFAULT_MAX_ARTICLE_AGE_DAYS,
): boolean {
  const parsed = parsePublishedDateText(publishedDate)
  if (!parsed) return true

  const issue = new Date(`${issueDate}T12:00:00Z`)
  if (Number.isNaN(issue.getTime())) return true

  const cutoff = new Date(issue)
  cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays)

  return parsed >= cutoff && parsed <= issue
}

function imageFromJsonLd(value: unknown, pageUrl?: string): string | null {
  if (!value) return null
  if (typeof value === 'string') return absolutizeUrl(value, pageUrl)

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageFromJsonLd(item, pageUrl)
      if (image) return image
    }
    return null
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      imageFromJsonLd(record.url, pageUrl) ||
      imageFromJsonLd(record.contentUrl, pageUrl) ||
      imageFromJsonLd(record.image, pageUrl)
    )
  }

  return null
}

export function extractOgImage(html: string, pageUrl?: string): string | null {
  const metaTagPattern = /<meta\b[^>]*>/gi
  const attrPattern = /([a-zA-Z_:.-]+)\s*=\s*["']([^"']*)["']/g
  const imageMetaNames = new Set([
    'og:image',
    'og:image:url',
    'og:image:secure_url',
    'twitter:image',
    'twitter:image:src',
  ])

  for (const tag of html.match(metaTagPattern) ?? []) {
    const attrs = new Map<string, string>()
    for (const match of tag.matchAll(attrPattern)) {
      attrs.set(match[1].toLowerCase(), match[2])
    }

    const name = attrs.get('property') ?? attrs.get('name') ?? attrs.get('itemprop')
    if (name && imageMetaNames.has(name.toLowerCase())) {
      const image = absolutizeUrl(attrs.get('content'), pageUrl)
      if (image) return image
    }
  }

  const imageSrcMatch = html.match(/<link\b[^>]+rel=["'][^"']*\bimage_src\b[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link\b[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*\bimage_src\b[^"']*["'][^>]*>/i)
  const imageSrc = absolutizeUrl(imageSrcMatch?.[1], pageUrl)
  if (imageSrc) return imageSrc

  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const scriptBlock of jsonLdMatch) {
      try {
        const content = scriptBlock.replace(/<script[^>]*>|<\/script>/gi, '')
        const data = JSON.parse(content)
        const entries = Array.isArray(data) ? data : [data]
        for (const entry of entries) {
          const image = imageFromJsonLd(entry?.image, pageUrl)
          if (image) return image
        }
      } catch { /* skip malformed JSON-LD */ }
    }
  }

  return null
}

export function extractPublishedDate(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']date["']/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      const date = new Date(match[1])
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    }
  }

  // Try JSON-LD structured data
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const scriptBlock of jsonLdMatch) {
      try {
        const content = scriptBlock.replace(/<script[^>]*>|<\/script>/gi, '')
        const data = JSON.parse(content)
        const entries = Array.isArray(data) ? data : [data]
        for (const entry of entries) {
          const raw = entry?.datePublished ?? entry?.dateCreated
          if (raw) {
            const date = new Date(raw)
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            }
          }
        }
      } catch { /* skip malformed JSON-LD */ }
    }
  }

  return null
}

export function extractTitle(html: string): string | null {
  let raw: string | null = null

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleTag) raw = titleTag[1]

  if (!raw) {
    const metaCandidates = [
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i),
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i),
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i),
    ]
    raw = metaCandidates.find(m => m && m[1]?.trim())?.[1] ?? null
  }

  if (!raw) return null

  return decodeHtmlAttribute(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[\|\-–—]\s*[^|\-–—]{2,40}$/, '')
    .trim() || null
}

/** Last-resort title — hostname is better than nothing */
export function hostnameFallback(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return 'Untitled article' }
}

// ─── Fetchers ────────────────────────────────────────────────────────────────────

/** Jina Reader fallback — handles Cloudflare-protected and JS-heavy sites */
export async function fetchViaJina(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { text: null, title: null, publishedDate: null, imageUrl: null }
    const raw = await res.text()
    const titleMatch = raw.match(/^Title:\s*(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? null
    const text = raw.replace(/^(Title|URL Source|Published Time):.*$/gm, '').trim().slice(0, 6000)
    const isBlocked = !text || text.length < 200 || /access denied|you don't have permission|enable javascript/i.test(text.slice(0, 300))
    return { text: isBlocked ? null : text, title, publishedDate: null, imageUrl: null }
  } catch {
    return { text: null, title: null, publishedDate: null, imageUrl: null }
  }
}

/**
 * Fetch article content + metadata from a URL.
 * Falls back to Jina Reader for bot-protected or JS-heavy pages.
 * @param onPdf  Optional callback fired when a PDF is detected (for progress logging)
 */
export async function fetchArticle(url: string, onPdf?: () => void): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    const isPdf = contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      onPdf?.()
      const buffer = Buffer.from(await res.arrayBuffer())
      try {
        const require = createRequire(import.meta.url)
        const { PDFParse } = require('pdf-parse')
        const parser = new PDFParse({ data: buffer, verbosity: 0 })
        const result = await parser.getText({ maxPages: 5 })
        const text = (result.text as string).replace(/\s{2,}/g, ' ').trim().slice(0, 6000)
        return { text, title: new URL(url).hostname.replace('www.', ''), publishedDate: null, imageUrl: null }
      } catch {
        return { text: null, title: null, publishedDate: null, imageUrl: null }
      }
    }

    const html = await res.text()
    const title = extractTitle(html)
    const publishedDate = extractPublishedDate(html)
    const imageUrl = extractOgImage(html, url)

    const mainMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const source = mainMatch ? mainMatch[1] : html

    const text = source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 6000)

    if (text.length < 200) {
      const fallback = await fetchViaJina(url)
      return {
        text: fallback.text,
        title: title ?? fallback.title,
        publishedDate: publishedDate ?? fallback.publishedDate,
        imageUrl: imageUrl ?? fallback.imageUrl,
      }
    }

    return { text, title, publishedDate, imageUrl }
  } catch {
    return fetchViaJina(url)
  }
}

/**
 * Lightweight metadata-only fetch — title + og:image, no AI summarization.
 * Used when you need a quick preview without the full article text.
 */
export async function fetchArticleMeta(url: string): Promise<{
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        Accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { title: null, publishedDate: null, imageUrl: null }
    const html = await res.text()
    return {
      title: extractTitle(html),
      publishedDate: extractPublishedDate(html),
      imageUrl: extractOgImage(html, url),
    }
  } catch {
    return { title: null, publishedDate: null, imageUrl: null }
  }
}
