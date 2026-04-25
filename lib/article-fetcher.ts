import { createRequire } from 'module'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface FetchResult {
  text: string | null
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}

// ─── HTML extraction helpers ─────────────────────────────────────────────────────

export function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]?.startsWith('http')) return match[1]
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

  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
    const imageUrl = extractOgImage(html)

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

    if (text.length < 200) throw new Error('Content too short — likely bot challenge')

    return { text, title, publishedDate, imageUrl }
  } catch {
    return fetchViaJina(url)
  }
}

/**
 * Lightweight metadata-only fetch — title + og:image, no AI summarization.
 * Used when you need a quick preview without the full article text.
 */
export async function fetchArticleMeta(url: string): Promise<{ title: string | null; imageUrl: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        Accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { title: null, imageUrl: null }
    const html = await res.text()
    return { title: extractTitle(html), imageUrl: extractOgImage(html) }
  } catch {
    return { title: null, imageUrl: null }
  }
}
