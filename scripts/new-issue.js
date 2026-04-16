#!/usr/bin/env node
/**
 * new-issue.js
 * Creates a new AI This Week issue in Notion with all sections pre-populated.
 * Optionally fetches article URLs and generates AI summaries via Claude.
 *
 * Usage:
 *   # Basic (placeholder text only)
 *   node --env-file=.env.local scripts/new-issue.js
 *   npm run new-issue
 *
 *   # With AI summaries for specific sections
 *   node --env-file=.env.local scripts/new-issue.js \
 *     --top="https://... https://..." \
 *     --bright="https://..." \
 *     --tool="https://..." \
 *     --learning="https://..." \
 *     --deep="https://..."
 *
 *   npm run new-issue -- --top="https://url1 https://url2" --bright="https://url3"
 */

const { Client } = require('@notionhq/client')
const OpenAI = require('openai')
const { PDFParse } = require('pdf-parse')

// ─── Env validation ────────────────────────────────────────────────────────────

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID

if (!process.env.NOTION_TOKEN || !DATABASE_ID) {
  console.error('❌  Missing NOTION_TOKEN or NOTION_DATABASE_ID.')
  console.error('    Run with: node --env-file=.env.local scripts/new-issue.js')
  process.exit(1)
}

// OPENAI_API_KEY is optional — only required when passing --top/--bright/etc.
// The script will warn at runtime if URLs are passed without the key.

// ─── CLI argument parsing ──────────────────────────────────────────────────────

/**
 * Parses --key="value" flags from process.argv.
 * Returns an object of { key: value } pairs.
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const result = {}
  for (const arg of args) {
    const match = arg.match(/^--([a-z]+)=(.+)$/)
    if (match) {
      result[match[1]] = match[2].trim()
    }
  }
  return result
}

/**
 * Splits a space-separated string of URLs into an array.
 * Handles quoted strings gracefully.
 */
function parseUrls(str) {
  if (!str) return []
  return str.split(/\s+/).filter(u => u.startsWith('http'))
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/** Returns the date of the next Monday as YYYY-MM-DD */
function nextMonday() {
  const today = new Date()
  const day = today.getDay() // 0 = Sun, 1 = Mon, …
  const daysUntil = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysUntil)
  return monday.toISOString().split('T')[0]
}

/** Formats a YYYY-MM-DD string as "Apr 21, 2026" */
function formatDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Notion helpers ────────────────────────────────────────────────────────────

/** Returns the highest Issue Number in the database (published or not) */
async function getNextIssueNumber() {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    sorts: [{ property: 'Issue Number', direction: 'descending' }],
    page_size: 1,
  })
  if (response.results.length === 0) return 1
  return (response.results[0].properties['Issue Number'].number ?? 0) + 1
}

/** Builds a rich_text array from a plain string */
function text(content) {
  return [{ type: 'text', text: { content } }]
}

/** Notion block constructors */
const block = {
  h2: (content) => ({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: text(content) },
  }),
  paragraph: (content) => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: text(content) },
  }),
  bullet: (content) => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: text(content) },
  }),
  divider: () => ({
    object: 'block',
    type: 'divider',
    divider: {},
  }),
  bookmark: (url) => ({
    object: 'block',
    type: 'bookmark',
    bookmark: { url, caption: [] },
  }),
}

// ─── Article fetching ──────────────────────────────────────────────────────────

/**
 * Fetches content from a URL — handles both HTML pages and PDFs.
 * Returns up to 6000 characters of clean readable text.
 */
async function fetchArticleText(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-This-Week-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    const isPdf = contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')

    if (isPdf) {
      console.log(`    📄 Detected PDF — extracting text…`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const parser = new PDFParse({ data: buffer, verbosity: 0 })
      const result = await parser.getText({ maxPages: 5 })
      // PDF text can be huge — take first 6000 chars from the parsed content
      return result.text.replace(/\s{2,}/g, ' ').trim().slice(0, 6000)
    }

    // HTML — extract meaningful body text, preferring <article> or <main>
    const html = await res.text()

    // Try to isolate the main content block before stripping tags
    const mainMatch = html.match(/<(?:article|main)[^>]*>([\s\S]*?)<\/(?:article|main)>/i)
    const source = mainMatch ? mainMatch[1] : html

    const stripped = source
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    return stripped.slice(0, 6000)
  } catch (err) {
    console.warn(`    ⚠️  Could not fetch ${url}: ${err.message}`)
    return null
  }
}

// ─── Claude summarisation ──────────────────────────────────────────────────────

// Lazily initialised — only created when AI summaries are requested
let openai = null
function getOpenAI() {
  if (!openai) openai = new OpenAI()
  return openai
}

// Switch to 'gpt-4o' for higher quality at ~20x the cost
const OPENAI_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPT = `You write concise, clear 2-3 sentence summaries for an AI newsletter aimed at a professional, non-technical audience. Your tone is informative and neutral — like a quality broadsheet news brief, not hype-driven tech journalism.

Rules:
- 2-3 sentences maximum, no bullet points
- Lead with what happened and why it matters
- Avoid jargon; if a technical term is essential, briefly explain it
- No "In this article..." or "The author argues..." framing
- Do not invent facts not present in the article text
- End with a period`

/**
 * Generates a 2-3 sentence summary for a single article URL.
 * Returns the summary string, or a placeholder if fetch/API fails.
 */
async function summariseUrl(url) {
  console.log(`    📡 Fetching: ${url}`)
  const articleText = await fetchArticleText(url)

  if (!articleText) {
    return `[Could not fetch article. Add summary manually.] Source: ${url}`
  }

  console.log(`    🤖 Summarising with OpenAI (${OPENAI_MODEL})…`)
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Please summarise this article in 2-3 sentences:\n\nURL: ${url}\n\n---\n\n${articleText}`,
        },
      ],
    })

    return response.choices[0]?.message?.content?.trim()
      ?? '[Summary unavailable — review and edit before publishing.]'
  } catch (err) {
    console.warn(`    ⚠️  OpenAI API error: ${err.message}`)
    return `[AI summary failed. Add manually.] Source: ${url}`
  }
}

/**
 * Summarises multiple URLs for a section.
 * Returns an array of summary strings (one per URL).
 */
async function summariseUrls(urls) {
  const summaries = []
  for (const url of urls) {
    const summary = await summariseUrl(url)
    summaries.push({ url, summary })
  }
  return summaries
}

// ─── Block builders ────────────────────────────────────────────────────────────

/** Builds the Top Stories blocks from summaries or placeholders.
 *  Each story gets a paragraph summary + a Notion bookmark block for the URL. */
function topStoriesBlocks(summaries) {
  if (summaries.length === 0) {
    return [
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
    ]
  }

  const blocks = []
  for (const { url, summary } of summaries) {
    blocks.push(block.paragraph(`🔹 ${summary}`))
    blocks.push(block.bookmark(url))
  }

  // Pad to at least 3 story slots
  const remaining = Math.max(0, 3 - summaries.length)
  for (let i = 0; i < remaining; i++) {
    blocks.push(block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'))
  }

  return blocks
}

/** Builds a summary + bookmark for a single-URL section, or a placeholder paragraph. */
function singleSectionBlocks(summaries, placeholder) {
  if (summaries.length === 0) {
    return [block.paragraph(placeholder)]
  }
  const { url, summary } = summaries[0]
  return [
    block.paragraph(summary),
    block.bookmark(url),
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = parseArgs()
  const hasUrls = argv.top || argv.bright || argv.tool || argv.learning || argv.deep

  const issueDate = nextMonday()
  const issueNumber = await getNextIssueNumber()
  const title = `AI This Week — ${formatDate(issueDate)}`

  console.log(`\n📝  Creating Issue #${issueNumber}: ${title}`)
  console.log(`    Date: ${issueDate}`)
  if (hasUrls) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌  OPENAI_API_KEY is required for AI summaries.')
      console.error('    Add it to .env.local and run again.')
      console.error('    Get your key at: https://platform.openai.com/api-keys')
      process.exit(1)
    }
    console.log(`    Mode: AI summaries enabled\n`)
  } else {
    console.log(`    Mode: Placeholder text only (pass --top="url1 url2" etc. for AI summaries)\n`)
  }

  // ── Fetch and summarise URLs ────────────────────────────────────────────────

  let topSummaries = []
  let brightSummaries = []
  let toolSummaries = []
  let learnSummaries = []
  let deepSummaries = []

  if (argv.top) {
    console.log('  📰 Top Stories:')
    topSummaries = await summariseUrls(parseUrls(argv.top))
  }
  if (argv.bright) {
    console.log('  🌟 Bright Spot:')
    brightSummaries = await summariseUrls(parseUrls(argv.bright))
  }
  if (argv.tool) {
    console.log('  🔧 Tool of the Week:')
    toolSummaries = await summariseUrls(parseUrls(argv.tool))
  }
  if (argv.learning) {
    console.log('  💡 Learning:')
    learnSummaries = await summariseUrls(parseUrls(argv.learning))
  }
  if (argv.deep) {
    console.log('  📖 Deep Dive:')
    deepSummaries = await summariseUrls(parseUrls(argv.deep))
  }

  if (hasUrls) console.log()

  // ── Create Notion page ──────────────────────────────────────────────────────

  console.log('  ✍️  Writing to Notion…')

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Title: { title: text(title) },
      'Issue Date': { date: { start: issueDate } },
      'Issue Number': { number: issueNumber },
      Published: { checkbox: false },
      'AI Assisted': { checkbox: true },
    },
    children: [
      block.paragraph('Hello,\n\nHere\'s your weekly update on the latest in AI.'),
      block.divider(),

      block.h2('Top Stories'),
      block.paragraph('⚠️ AI-generated summaries below — review and edit each one before publishing.'),
      ...topStoriesBlocks(topSummaries),
      block.divider(),

      block.h2('🌟 Bright Spot of the Week'),
      ...singleSectionBlocks(
        brightSummaries,
        '[AI-generated summary. Review for accuracy and edit before publishing.]'
      ),
      block.divider(),

      block.h2('🔧 Tool of the Week'),
      ...singleSectionBlocks(
        toolSummaries,
        '[AI-generated summary. Review for accuracy and edit before publishing.]'
      ),
      block.divider(),

      block.h2('💡 Learning'),
      ...singleSectionBlocks(
        learnSummaries,
        '[AI-generated summary. Review for accuracy and edit before publishing.]'
      ),
      block.divider(),

      block.h2('📖 Deep Dive'),
      ...singleSectionBlocks(
        deepSummaries,
        '[AI-generated summary. Review for accuracy and edit before publishing.]'
      ),
    ],
  })

  console.log(`\n✅  Issue created successfully!`)
  console.log(`    Notion URL: ${page.url}`)
  console.log(`\n    ⚠️  AI summaries are drafts — always review before publishing.`)
  console.log(`    When ready: check the "Published" checkbox in Notion.\n`)
}

main().catch(err => {
  console.error('❌  Failed to create issue:', err.message)
  process.exit(1)
})
