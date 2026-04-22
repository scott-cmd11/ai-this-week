import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createRequire } from 'module'
import { SYSTEM_PROMPTS, type SummaryLength } from '@/lib/prompts'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FetchResult {
  text: string | null
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}

// ─── Article fetching (shared logic — mirrors new-issue & update-issue) ─────────

function extractOgImage(html: string): string | null {
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

function extractPublishedDate(html: string): string | null {
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
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const b of jsonLdMatch) {
      try {
        const content = b.replace(/<script[^>]*>|<\/script>/gi, '')
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
      } catch { /* skip */ }
    }
  }
  return null
}

function extractTitle(html: string): string | null {
  // 1. <title> · 2. og:title · 3. twitter:title · 4. null → hostname upstream
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
    .replace(/\s*[\|\-–—]\s*[^|\-–—]{2,40}$/, '')
    .trim() || null
}

// Jina Reader fallback — handles Cloudflare-protected and JS-heavy sites.
// Free, no API key needed. Returns clean article text.
async function fetchViaJina(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { text: null, title: null, publishedDate: null, imageUrl: null }
    const raw = await res.text()
    // Jina prepends "Title: ..." and "URL Source: ..." lines — extract title if present
    const titleMatch = raw.match(/^Title:\s*(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? null
    const text = raw.replace(/^(Title|URL Source|Published Time):.*$/gm, '').trim().slice(0, 6000)
    // Treat access-denied / bot-challenge responses as failures
    const isBlocked = !text || text.length < 200 || /access denied|you don't have permission|enable javascript/i.test(text.slice(0, 300))
    return { text: isBlocked ? null : text, title, publishedDate: null, imageUrl: null }
  } catch {
    return { text: null, title: null, publishedDate: null, imageUrl: null }
  }
}

async function fetchArticle(url: string): Promise<FetchResult> {
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
      .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ').trim().slice(0, 6000)

    // If text is suspiciously short it's likely a bot-challenge page — fall back to Jina
    if (text.length < 200) throw new Error('Content too short — likely bot challenge')

    return { text, title, publishedDate, imageUrl }
  } catch {
    // Fallback: Jina Reader handles Cloudflare-protected and JS-rendered pages
    return fetchViaJina(url)
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: { password: string; url: string; summaryLength?: SummaryLength }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  if (!body.url || !body.url.startsWith('http')) {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 })
  }

  const { url, summaryLength = 'standard' } = body
  const systemPrompt = SYSTEM_PROMPTS[summaryLength] ?? SYSTEM_PROMPTS.standard

  const { text: articleText, title, publishedDate, imageUrl } = await fetchArticle(url)

  if (!articleText) {
    return NextResponse.json({
      summary: '[Could not fetch article. Add summary manually.]',
      title,
      publishedDate,
      imageUrl,
    })
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please summarise this article:\n\nURL: ${url}\n\n---\n\n${articleText}` },
      ],
    })
    const summary = response.choices[0]?.message?.content?.trim() ?? '[Summary unavailable.]'
    return NextResponse.json({ summary, title, publishedDate, imageUrl })
  } catch {
    return NextResponse.json({ summary: '[AI summary failed. Add manually.]', title, publishedDate, imageUrl })
  }
}
