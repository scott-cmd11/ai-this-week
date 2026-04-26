// ─── Briefing parser ────────────────────────────────────────────────────────────
// Pure function: takes Notion block array → returns structured articles.
//
// The parser knows the briefing-page convention used by sources like the
// "🇨🇦 Canada AI - Daily" briefings:
//
//   ## Overview              ← skipped (intro paragraph)
//   ## Flagged Items         ← topics flagged as notable, no URLs
//   ## [Category Name]       ← a categorized section
//     - **Title.** Summary text. ([Source 1](url1)) ([Source 2](url2))
//     - **Title.** Summary text. ([Source](url))
//
// A bulleted_list_item is treated as an article when it contains at least one
// bold segment (the title) AND at least one rich_text with a link annotation
// (the source URL we'll bookmark).

// ─── Public types ──────────────────────────────────────────────────────────────

export interface ParsedArticle {
  title: string         // bold prefix, period stripped
  summary: string       // text after bold, parenthesized citations stripped
  urls: string[]        // every linked URL found in the bullet (first = primary)
  rawText: string       // entire concatenated bullet text — useful for debugging
}

export interface ParsedSection {
  name: string                 // h2 heading text
  articles: ParsedArticle[]
}

export interface ParsedBriefing {
  flaggedTopics: string[]      // bold prefixes from "Flagged Items" bullets
  sections: ParsedSection[]    // categorized sections only
}

// ─── Internal helpers ───────────────────────────────────────────────────────────

interface RichTextLite {
  text: string
  bold: boolean
  link: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRichText(richText: any[]): RichTextLite[] {
  return richText.map(seg => ({
    text: seg?.plain_text ?? '',
    bold: seg?.annotations?.bold ?? false,
    // Notion provides both seg.text.link.url (for text-type rich_text) and
    // a top-level seg.href that mirrors it. Either is acceptable.
    link: seg?.text?.link?.url ?? seg?.href ?? null,
  }))
}

/**
 * Parse a single bulleted_list_item's rich_text into article shape.
 * Returns null if no bold segment found (treat as non-article noise).
 *
 * Algorithm:
 *  1. Find the first contiguous run of bold (non-link) segments → title
 *     (skipping leading non-bold prefix like "🚩 ", since flagged items
 *     start with an emoji before the bold)
 *  2. After the bold ends, accumulate non-link text → summary, until we
 *     encounter the first linked segment
 *  3. From the first link onward, collect URLs but ignore any plain text
 *     between them (they're just the "(" and ")" wrapping the citations)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBullet(richText: any[]): ParsedArticle | null {
  const segments = normalizeRichText(richText)
  const firstBoldIdx = segments.findIndex(s => s.bold && !s.link)
  if (firstBoldIdx === -1) return null

  // Title: contiguous bold (non-link) segments starting at firstBoldIdx
  let title = ''
  let i = firstBoldIdx
  while (i < segments.length && segments[i].bold && !segments[i].link) {
    title += segments[i].text
    i++
  }

  // After title: summary until first link; URLs collected from links onward
  let summary = ''
  const urls: string[] = []
  for (; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.link) {
      urls.push(seg.link)
      continue
    }
    if (urls.length === 0) summary += seg.text
    // else: parens/whitespace between citations → ignore
  }

  return {
    title: title.trim().replace(/[.\s]+$/, '') || '(untitled)',
    summary: summary
      .trim()
      .replace(/^[\s—–-]+/, '')        // strip leading em/en dashes
      .replace(/\s*\(\s*$/, '')        // strip dangling " (" from before citations
      .trim(),
    urls,
    rawText: segments.map(s => s.text).join(''),
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Walk the top-level blocks of a briefing page and pull out the structured
 * article list. Pure function — no I/O, no Notion client needed.
 *
 * Caller is responsible for fetching the blocks via
 * `notion.blocks.children.list({ block_id })` and handling pagination.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseBriefingBlocks(blocks: any[]): ParsedBriefing {
  const flaggedTopics: string[] = []
  const sections: ParsedSection[] = []
  let currentHeading: string | null = null
  let currentSection: ParsedSection | null = null

  for (const block of blocks) {
    if (block?.type === 'heading_2') {
      const headingText = (block.heading_2?.rich_text ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r?.plain_text ?? '')
        .join('')
        .trim()
      currentHeading = headingText
      // Overview and Flagged Items are handled specially — not pushed as sections
      if (headingText === 'Overview' || headingText === 'Flagged Items') {
        currentSection = null
      } else if (headingText) {
        currentSection = { name: headingText, articles: [] }
        sections.push(currentSection)
      } else {
        currentSection = null
      }
      continue
    }

    if (block?.type !== 'bulleted_list_item') continue
    if (!currentHeading) continue

    const richText = block.bulleted_list_item?.rich_text ?? []

    if (currentHeading === 'Flagged Items') {
      const article = parseBullet(richText)
      if (article && article.title) flaggedTopics.push(article.title)
      continue
    }

    if (currentHeading === 'Overview') continue

    if (currentSection) {
      const article = parseBullet(richText)
      // Require at least one URL — without a source link, we can't bookmark it
      if (article && article.urls.length > 0) {
        currentSection.articles.push(article)
      }
    }
  }

  return { flaggedTopics, sections }
}
