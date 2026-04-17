import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createRequire } from 'module'

// ─── Types ─────────────────────────────────────────────────────────────────────

type SectionKey = 'top' | 'bright' | 'tool' | 'learning' | 'deep'

interface FetchResult {
  text: string | null
  title: string | null
  publishedDate: string | null
  imageUrl: string | null
}

// ─── Section descriptions for the AI prompt ─────────────────────────────────────

const SECTION_DESCRIPTIONS: Record<SectionKey, string> = {
  top: 'Major AI news, announcements, or industry developments that affect many people',
  bright: 'Uplifting, positive, or hopeful stories about AI benefiting people or society',
  tool: 'New AI tools, apps, products, or services worth knowing about or trying',
  learning: 'Educational articles, tutorials, explainers, or how-to content about AI',
  deep: 'Long-form analysis, research papers, academic studies, or in-depth AI essays',
}

const VALID_SECTIONS = new Set<SectionKey>(['top', 'bright', 'tool', 'learning', 'deep'])

// ─── Article fetching (mirrors other routes) ────────────────────────────────────

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]?.startsWith('http')) return m[1]
  }
  return null
}

function extractPublishedDate(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) {
      const d = new Date(m[1])
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    }
  }
  return null
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (!m) return null
  return m[1]
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
    .replace(/\s*[\|\-–—]\s*[^|\-–—]{2,40}$/, '')
    .trim() || null
}

async function fetchArticle(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      signal: AbortSignal.timeout(15_000),
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
        const result = await parser.getText({ maxPages: 2 })
        const text = (result.text as string).replace(/\s{2,}/g, ' ').trim().slice(0, 2000)
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
      .replace(/\s{2,}/g, ' ').trim().slice(0, 2000) // shorter for section suggestion

    return { text, title, publishedDate, imageUrl }
  } catch {
    return { text: null, title: null, publishedDate: null, imageUrl: null }
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const openaiApiKey = process.env.OPENAI_API_KEY

  if (!adminPassword || !openaiApiKey) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let body: { password: string; url: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  if (!body.url?.startsWith('http')) {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 })
  }

  const { url } = body
  const { text, title, publishedDate, imageUrl } = await fetchArticle(url)

  // Build the section descriptions list
  const sectionList = (Object.keys(SECTION_DESCRIPTIONS) as SectionKey[])
    .map(k => `- ${k}: ${SECTION_DESCRIPTIONS[k]}`)
    .join('\n')

  const prompt = [
    `You are categorising articles for an AI newsletter. The newsletter has these sections:`,
    sectionList,
    ``,
    `Article URL: ${url}`,
    title ? `Article title: ${title}` : '',
    text ? `Article snippet: ${text.slice(0, 600)}` : '',
    ``,
    `Which section (top/bright/tool/learning/deep) best fits this article?`,
    `Reply with ONLY the section key — one word, lowercase, no punctuation.`,
  ].filter(Boolean).join('\n')

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey })
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? ''
    const section: SectionKey = VALID_SECTIONS.has(raw as SectionKey)
      ? (raw as SectionKey)
      : 'top' // fallback

    return NextResponse.json({ section, title, publishedDate, imageUrl })
  } catch {
    // On GPT failure, default to top stories
    return NextResponse.json({ section: 'top' as SectionKey, title, publishedDate, imageUrl })
  }
}
