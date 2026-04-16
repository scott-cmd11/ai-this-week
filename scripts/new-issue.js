#!/usr/bin/env node
/**
 * new-issue.js
 * Creates a new AI This Week issue in Notion with all sections pre-populated.
 *
 * Usage:
 *   node --env-file=.env.local scripts/new-issue.js
 */

const { Client } = require('@notionhq/client')

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DATABASE_ID = process.env.NOTION_DATABASE_ID

if (!process.env.NOTION_TOKEN || !DATABASE_ID) {
  console.error('❌  Missing NOTION_TOKEN or NOTION_DATABASE_ID.')
  console.error('    Run with: node --env-file=.env.local scripts/new-issue.js')
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const issueDate = nextMonday()
  const issueNumber = await getNextIssueNumber()
  const title = `AI This Week — ${formatDate(issueDate)}`

  console.log(`\n📝  Creating Issue #${issueNumber}: ${title}`)
  console.log(`    Date: ${issueDate}\n`)

  // Create the page with metadata properties
  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Title: { title: text(title) },
      'Issue Date': { date: { start: issueDate } },
      'Issue Number': { number: issueNumber },
      Published: { checkbox: false },
      'AI Assisted': { checkbox: true },
    },
    // Seed the page body with standard sections
    children: [
      block.paragraph('Hello,\n\nHere\'s your weekly update on the latest in AI.'),
      block.divider(),

      block.h2('Top Stories'),
      block.paragraph('⚠️ AI-generated summaries below — review and edit each one before publishing.'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.bullet('🔹 [Story title] — [AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.divider(),

      block.h2('🌟 Bright Spot of the Week'),
      block.paragraph('[AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.divider(),

      block.h2('🔧 Tool of the Week'),
      block.paragraph('[AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.divider(),

      block.h2('💡 Learning'),
      block.paragraph('[AI-generated summary. Review for accuracy and edit before publishing.]'),
      block.divider(),

      block.h2('📖 Deep Dive'),
      block.paragraph('[AI-generated summary. Review for accuracy and edit before publishing.]'),
    ],
  })

  const pageUrl = page.url
  console.log(`✅  Issue created successfully!`)
  console.log(`    Notion URL: ${pageUrl}`)
  console.log(`\n    When ready to publish: check the "Published" checkbox in Notion.`)
  console.log(`    The site will update within 5 minutes.\n`)
}

main().catch(err => {
  console.error('❌  Failed to create issue:', err.message)
  process.exit(1)
})
