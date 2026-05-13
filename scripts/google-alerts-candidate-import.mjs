#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const DEFAULT_API_BASE = 'https://aitoday.vercel.app'
const DEFAULT_OUTPUT_ROOT = 'tmp/google-alerts-current'
const DEFAULT_SOURCE = 'Google Alerts Current RSS'
const DEFAULT_SOURCE_TYPE = 'google_alerts'
const DEFAULT_LIMIT = 35

const AI_PATTERNS = [
  /\bai\b/i,
  /artificial intelligence/i,
  /machine learning/i,
  /large language model/i,
  /\bllm\b/i,
  /generative/i,
  /chatgpt/i,
  /openai/i,
  /anthropic/i,
  /deepmind/i,
  /copilot/i,
  /\bagents?\b/i,
]

const CANADA_PATTERNS = [
  /canada/i,
  /canadian/i,
  /ottawa/i,
  /toronto/i,
  /montreal/i,
  /vancouver/i,
  /winnipeg/i,
  /manitoba/i,
  /ontario/i,
  /quebec/i,
  /alberta/i,
  /british columbia/i,
  /saskatchewan/i,
  /nova scotia/i,
  /new brunswick/i,
  /newfoundland/i,
  /prince edward island/i,
  /yukon/i,
  /northwest territories/i,
  /nunavut/i,
  /\.ca\b/i,
]

const NOISE_PATTERNS = [
  /coupon/i,
  /promo code/i,
  /horoscope/i,
  /lottery/i,
  /job alert/i,
  /jobs?\b/i,
  /hiring/i,
  /apply now/i,
  /salary/i,
  /career/i,
  /internship/i,
  /weather forecast/i,
  /stock price/i,
  /price target/i,
  /earnings call transcript/i,
]

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'threads.net',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'reddit.com',
]

function usage() {
  console.log(`Usage:
  node scripts/google-alerts-candidate-import.mjs [--import] [--verify]

Options:
  --api-base              Candidate API base URL. Defaults to ${DEFAULT_API_BASE}.
  --output-root           Directory for timestamped run output. Defaults to ${DEFAULT_OUTPUT_ROOT}.
  --source                Candidate source label. Defaults to "${DEFAULT_SOURCE}".
  --type                  Candidate source type. Defaults to ${DEFAULT_SOURCE_TYPE}.
  --limit                 Max curated candidates to pass to the importer. Defaults to ${DEFAULT_LIMIT}.
  --import                Post candidates after the dry-run succeeds.
  --verify                Read back the candidate API after import.
  --write-github-output   Write run metadata to $GITHUB_OUTPUT when available.

Environment:
  GOOGLE_ALERTS_FEED_URLS is required in CI. It can be a JSON array, newline list, or comma-separated list.
  ARTICLE_CANDIDATE_INGEST_TOKEN, CRON_SECRET, or ADMIN_PASSWORD is required when --import is used.
`)
}

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

function hasArg(name) {
  return process.argv.includes(name)
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, '').replace(/:/g, '-')
}

function decodeXml(value) {
  return String(value ?? '')
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
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function stripHtml(value) {
  return decodeXml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tagText(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match ? decodeXml(match[1]).trim() : ''
}

function attrText(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
  return match ? decodeXml(match[1]).trim() : ''
}

function atomLink(entry) {
  const links = [...entry.matchAll(/<link\b[^>]*\/?>/gi)].map(match => match[0])
  const alternate = links.find(link => attrText(link, 'rel') === 'alternate')
  return attrText(alternate ?? links[0] ?? '', 'href')
}

function unwrapGoogleUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'google.com') {
      const target = parsed.searchParams.get('url') || parsed.searchParams.get('q')
      if (target?.startsWith('http')) return target
    }
    return url
  } catch {
    return url
  }
}

function canonicalUrl(url) {
  const unwrapped = unwrapGoogleUrl(url.trim())
  try {
    const parsed = new URL(unwrapped)
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase()
      if (
        lower.startsWith('utm_') ||
        ['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 's', 'source'].includes(lower)
      ) {
        parsed.searchParams.delete(key)
      }
    }
    return parsed.href
  } catch {
    return unwrapped
  }
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function normalizeTitleKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(value) {
  if (!value?.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function publishedIso(value) {
  const date = parseDate(value)
  return date ? date.toISOString() : null
}

function parseRssItems(xml, feedIndex) {
  const matches = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
  return matches.map((match, index) => {
    const item = match[1]
    const title = stripHtml(tagText(item, 'title'))
    const link = stripHtml(tagText(item, 'link') || tagText(item, 'guid'))
    const summary = stripHtml(tagText(item, 'description') || tagText(item, 'content:encoded'))
    const publishedRaw = tagText(item, 'pubDate') || tagText(item, 'dc:date')
    return {
      id: `rss-${feedIndex}-${index}`,
      title,
      url: canonicalUrl(link),
      snippet: summary,
      published: publishedIso(publishedRaw),
      published_raw: publishedRaw || null,
    }
  })
}

function parseAtomItems(xml, feedIndex) {
  const matches = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)]
  return matches.map((match, index) => {
    const entry = match[1]
    const title = stripHtml(tagText(entry, 'title'))
    const summary = stripHtml(tagText(entry, 'summary') || tagText(entry, 'content'))
    const publishedRaw = tagText(entry, 'published') || tagText(entry, 'updated')
    return {
      id: `atom-${feedIndex}-${index}`,
      title,
      url: canonicalUrl(atomLink(entry)),
      snippet: summary,
      published: publishedIso(publishedRaw),
      published_raw: publishedRaw || null,
    }
  })
}

function parseFeed(xml, feedIndex) {
  return xml.includes('<entry') ? parseAtomItems(xml, feedIndex) : parseRssItems(xml, feedIndex)
}

async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Today/1.0; +https://aitoday.vercel.app)',
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

function splitFeedUrls(raw) {
  const trimmed = raw?.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) throw new Error('GOOGLE_ALERTS_FEED_URLS JSON must be an array.')
    return parsed.map(String).map(value => value.trim()).filter(Boolean)
  }
  return trimmed
    .split(/\r?\n|,/)
    .map(value => value.trim())
    .filter(Boolean)
}

async function listJsonFiles(root) {
  const found = []
  async function walk(dir) {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (/google_alerts.*\.json$/i.test(entry.name)) {
        const stat = await fs.stat(full)
        found.push({ full, mtimeMs: stat.mtimeMs })
      }
    }
  }
  await walk(root)
  return found
}

async function readFeedUrlsFromLocalArtifacts() {
  const roots = ['tmp/google-alerts-current', 'tmp/may9-automation-output']
  const files = []
  for (const root of roots) {
    files.push(...await listJsonFiles(root))
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  for (const file of files) {
    try {
      const payload = JSON.parse(await fs.readFile(file.full, 'utf8'))
      const feedUrls = Array.isArray(payload.feed_urls)
        ? payload.feed_urls
        : Array.isArray(payload.feedUrls)
          ? payload.feedUrls
          : []
      if (feedUrls.length > 0) {
        return {
          feedUrls: feedUrls.map(String).map(value => value.trim()).filter(Boolean),
          source: file.full,
        }
      }
    } catch {
      // Ignore malformed scratch artifacts and keep searching.
    }
  }
  return { feedUrls: [], source: null }
}

async function loadFeedUrls() {
  const fromEnv = splitFeedUrls(process.env.GOOGLE_ALERTS_FEED_URLS)
  if (fromEnv.length > 0) return { feedUrls: [...new Set(fromEnv)], source: 'GOOGLE_ALERTS_FEED_URLS' }

  if (process.env.CI) {
    throw new Error('GOOGLE_ALERTS_FEED_URLS is required in CI.')
  }

  const local = await readFeedUrlsFromLocalArtifacts()
  if (local.feedUrls.length === 0) {
    throw new Error('No Google Alerts feed URLs found. Set GOOGLE_ALERTS_FEED_URLS or keep a local feed artifact under tmp/.')
  }
  return { feedUrls: [...new Set(local.feedUrls)], source: local.source }
}

function categoryFor(entry) {
  const text = `${entry.title} ${entry.snippet} ${entry.url}`.toLowerCase()
  if (CANADA_PATTERNS.some(pattern => pattern.test(text))) return 'Canada'
  if (/policy|regulation|privacy|copyright|governance|law|senate|parliament/.test(text)) return 'Policy & Regulation'
  if (/government|public sector|federal|municipal|sovereign/.test(text)) return 'Government & Public Sector'
  if (/research|paper|benchmark|arxiv|study|university|nature\.com|science/.test(text)) return 'Research'
  if (/health|education|agriculture|manufacturing|finance|legal|classroom|hospital/.test(text)) return 'Sectors & Applications'
  return 'Industry & Models'
}

function scoreEntry(entry) {
  const text = `${entry.title} ${entry.snippet} ${entry.url}`
  let score = 35
  if (AI_PATTERNS.some(pattern => pattern.test(text))) score += 20
  if (CANADA_PATTERNS.some(pattern => pattern.test(text))) score += 25
  if (/policy|regulation|governance|privacy|copyright|public sector|government/i.test(text)) score += 8
  if (/research|paper|benchmark|model|agent|openai|anthropic|deepmind/i.test(text)) score += 6
  if (/opinion|sponsored|press release/i.test(text)) score -= 8
  return Math.max(0, Math.min(100, score))
}

function skipReason(entry) {
  if (!entry.title || !entry.url.startsWith('http')) return 'missing_title_or_url'

  const host = hostname(entry.url)
  if (SOCIAL_HOSTS.some(socialHost => host === socialHost || host.endsWith(`.${socialHost}`))) {
    return 'social_post'
  }

  const text = `${entry.title} ${entry.snippet} ${entry.url}`
  if (!AI_PATTERNS.some(pattern => pattern.test(text))) return 'not_ai_enough'
  if (NOISE_PATTERNS.some(pattern => pattern.test(text))) return 'noise'

  const published = parseDate(entry.published)
  if (published) {
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - published.getTime() > maxAgeMs) return 'stale'
  }

  return null
}

function buildCandidate(entry) {
  const category = categoryFor(entry)
  const score = scoreEntry(entry)
  const reasons = [
    'Fetched from Google Alerts RSS in the evening cloud import',
    category === 'Canada' ? 'Canadian relevance' : '',
    entry.published ? `Published: ${entry.published.slice(0, 10)}` : '',
    `Source host: ${hostname(entry.url) || 'unknown'}`,
  ].filter(Boolean)

  return {
    title: entry.title,
    url: entry.url,
    snippet: entry.snippet || 'See source for details.',
    published: entry.published,
    published_raw: entry.published_raw,
    category,
    score,
    score_reasons: reasons,
  }
}

function selectCandidates(entries, limit) {
  const skipCounts = {}
  const seenUrls = new Set()
  const seenTitles = new Set()
  const accepted = []

  for (const entry of entries) {
    const reason = skipReason(entry)
    if (reason) {
      skipCounts[reason] = (skipCounts[reason] ?? 0) + 1
      continue
    }

    const urlKey = canonicalUrl(entry.url)
    const titleKey = normalizeTitleKey(entry.title)
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) {
      skipCounts.duplicate = (skipCounts.duplicate ?? 0) + 1
      continue
    }
    seenUrls.add(urlKey)
    seenTitles.add(titleKey)
    accepted.push(buildCandidate(entry))
  }

  accepted.sort((a, b) => {
    const aCanada = a.category === 'Canada' ? 1 : 0
    const bCanada = b.category === 'Canada' ? 1 : 0
    return bCanada - aCanada || b.score - a.score || a.title.localeCompare(b.title)
  })

  return {
    firstPass: accepted.slice(0, Math.max(limit * 2, limit)),
    curated: accepted.slice(0, limit),
    skipCounts,
  }
}

async function writeJson(file, payload) {
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function runImporter({ curatedFile, source, sourceType, apiBase, dryRun }) {
  const args = [
    'scripts/import-candidates-from-automation-output.mjs',
    '--source',
    source,
    '--type',
    sourceType,
    '--api-base',
    apiBase,
    '--file',
    curatedFile,
  ]
  if (dryRun) args.push('--dry-run')

  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }).status ?? 1
}

function authHeaders() {
  const token = process.env.ARTICLE_CANDIDATE_INGEST_TOKEN || process.env.CRON_SECRET
  const adminPassword = process.env.ADMIN_PASSWORD
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (adminPassword) headers['x-admin-password'] = adminPassword
  return headers
}

async function verifyCandidateApi(apiBase) {
  const headers = authHeaders()
  if (!headers.Authorization && !headers['x-admin-password']) {
    console.log('Skipping API verification because no candidate API auth env is available.')
    return
  }

  const response = await fetch(`${apiBase}/api/article-candidates?status=new,approved,shortlisted&limit=5`, {
    headers,
  })
  const body = await response.json().catch(async () => ({ text: await response.text() }))
  if (!response.ok) {
    throw new Error(`Candidate API verification failed with HTTP ${response.status}: ${JSON.stringify(body)}`)
  }
  console.log(JSON.stringify({
    verification: 'candidate_api_reachable',
    configured: body.configured,
    returned: Array.isArray(body.candidates) ? body.candidates.length : null,
  }, null, 2))
}

async function writeGithubOutput(values) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile) return
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value).replace(/\r?\n/g, ' ')}`)
  await fs.appendFile(outputFile, `${lines.join('\n')}\n`, 'utf8')
}

async function main() {
  if (hasArg('--help')) {
    usage()
    return
  }

  const apiBase = (readArg('--api-base', process.env.AI_TODAY_API_BASE || DEFAULT_API_BASE)).replace(/\/$/, '')
  const outputRoot = readArg('--output-root', DEFAULT_OUTPUT_ROOT)
  const source = readArg('--source', DEFAULT_SOURCE)
  const sourceType = readArg('--type', DEFAULT_SOURCE_TYPE)
  const limit = Number(readArg('--limit', process.env.GOOGLE_ALERTS_CANDIDATE_LIMIT || DEFAULT_LIMIT))
  const shouldImport = hasArg('--import')
  const shouldVerify = hasArg('--verify')
  const shouldWriteGithubOutput = hasArg('--write-github-output')

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('--limit must be a positive number.')
  }

  const { feedUrls, source: feedUrlSource } = await loadFeedUrls()
  const runDir = path.join(outputRoot, timestampSlug())
  await fs.mkdir(runDir, { recursive: true })

  const failures = []
  const entries = []
  for (const [index, url] of feedUrls.entries()) {
    try {
      const xml = await fetchFeed(url)
      entries.push(...parseFeed(xml, index))
    } catch (error) {
      failures.push({
        feedIndex: index,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const { firstPass, curated, skipCounts } = selectCandidates(entries, limit)
  const basePayload = {
    run_at: new Date().toISOString(),
    feed_url_source: feedUrlSource,
    feed_url_count: feedUrls.length,
    feeds_attempted: feedUrls.length,
    failures,
    raw_entries: entries.length,
    skip_counts: skipCounts,
  }

  const firstPassFile = path.join(runDir, 'google_alerts_ai_candidates.json')
  const curatedFile = path.join(runDir, 'google_alerts_ai_candidates_curated.json')
  await writeJson(firstPassFile, {
    ...basePayload,
    included_articles: firstPass.length,
    selected: firstPass,
  })
  await writeJson(curatedFile, {
    ...basePayload,
    included_articles: curated.length,
    selected: curated,
    curation_note: 'Selected by the cloud Google Alerts import script using AI relevance, Canada-first ordering, dedupe, freshness, and noise filters.',
  })

  const summary = {
    feedsAttempted: feedUrls.length,
    feedFailures: failures.length,
    rawEntries: entries.length,
    firstPassCandidates: firstPass.length,
    curatedCandidates: curated.length,
    curatedFile,
  }
  console.log(JSON.stringify(summary, null, 2))

  if (shouldWriteGithubOutput) {
    await writeGithubOutput({
      run_dir: runDir,
      curated_file: curatedFile,
      curated_count: curated.length,
      feed_failures: failures.length,
    })
  }

  if (curated.length === 0) {
    console.log('No usable Google Alerts candidates found. Nothing to import.')
    return
  }

  const dryRunStatus = runImporter({ curatedFile, source, sourceType, apiBase, dryRun: true })
  if (dryRunStatus !== 0) {
    process.exitCode = dryRunStatus
    return
  }

  if (!shouldImport) return

  const importStatus = runImporter({ curatedFile, source, sourceType, apiBase, dryRun: false })
  if (importStatus !== 0) {
    process.exitCode = importStatus
    return
  }

  if (shouldVerify) {
    await verifyCandidateApi(apiBase)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
