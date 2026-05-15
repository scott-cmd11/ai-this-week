import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'config', 'ai-good-news-sources.json')
const outDir = path.join(root, 'tmp', 'ai-good-news-ingest')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run') || !process.env.AI_GOOD_NEWS_INGEST_URL
const currentWindowHours = 24
const fallbackWindowHours = 48

const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
const sources = config.filter(source => source.enabled)
const candidates = []
const errors = []

for (const source of sources) {
  try {
    const res = await fetch(source.url, {
      headers: {
        'User-Agent': 'AI Good News MVP RSS reader (respectful RSS fetch)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    for (const item of parseItems(xml).slice(0, 20)) {
      if (hoursSincePublished(item.publishedAt) > fallbackWindowHours) continue
      candidates.push({
        title: item.title,
        url: item.link,
        source: item.sourceName || source.name,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt,
        summary: item.description,
        category: source.default_category,
      })
    }
  } catch (err) {
    errors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

await fs.mkdir(outDir, { recursive: true })
const outputPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
const primaryCandidates = candidates.filter(candidate => hoursSincePublished(candidate.publishedAt) <= currentWindowHours)
const expandedToFallback = primaryCandidates.length === 0
const selectedCandidates = expandedToFallback ? candidates : primaryCandidates
await fs.writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  lookbackWindowHours: expandedToFallback ? fallbackWindowHours : currentWindowHours,
  expandedToFallback,
  candidates: selectedCandidates,
  errors,
}, null, 2))

if (!dryRun) {
  const res = await fetch(process.env.AI_GOOD_NEWS_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': process.env.AI_GOOD_NEWS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    throw new Error(`Ingest API failed: ${res.status} ${await res.text()}`)
  }
}

console.log(JSON.stringify({
  checkedSources: sources.length,
  candidates: selectedCandidates.length,
  currentWindowHours: expandedToFallback ? fallbackWindowHours : currentWindowHours,
  expandedToFallback,
  errors,
  outputPath,
  dryRun,
}, null, 2))

function parseItems(xml) {
  const matches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  const entries = matches.length > 0 ? matches : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
  return entries.map(match => {
    const raw = match[0]
    const source = readSource(raw)
    return {
      title: cleanTitle(decodeXml(readTag(raw, 'title')), source.name),
      link: decodeXml(readTag(raw, 'link') || readAtomLink(raw)),
      sourceName: source.name,
      sourceUrl: source.url,
      publishedAt: normalizeDate(readTag(raw, 'pubDate') || readTag(raw, 'published') || readTag(raw, 'updated')),
      description: stripHtml(decodeXml(readTag(raw, 'description') || readTag(raw, 'summary') || readTag(raw, 'content:encoded'))),
    }
  }).filter(item => item.title && item.link)
}

function readTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1]?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() || ''
}

function readAtomLink(xml) {
  return xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]?.trim() || ''
}

function readSource(xml) {
  const match = xml.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i)
  if (!match) return { name: null, url: null }
  return {
    name: decodeXml(match[2] || '') || null,
    url: decodeXml((match[1] || '').match(/\burl=["']([^"']+)["']/i)?.[1] || '') || null,
  }
}

function normalizeDate(value) {
  if (!value) return null
  const parsed = new Date(decodeXml(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function hoursSincePublished(value) {
  if (!value) return Number.POSITIVE_INFINITY
  const published = new Date(value)
  if (Number.isNaN(published.getTime())) return Number.POSITIVE_INFINITY
  return Math.max(0, (Date.now() - published.getTime()) / 3_600_000)
}

function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanTitle(title, sourceName) {
  if (!sourceName) return title
  const suffix = ` - ${sourceName}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title
}
