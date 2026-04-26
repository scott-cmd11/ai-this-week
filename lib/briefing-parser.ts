// ─── Briefing parser ────────────────────────────────────────────────────────────
// Pure function: takes Notion block array → returns structured articles.
//
// The parser handles two related briefing-page conventions:
//
// 1. Canada AI Daily style — title is bold, source links come after:
//      ## [Category Name]
//        - **Title.** Summary text. ([Source 1](url1)) ([Source 2](url2))
//
// 2. Google Alerts Digest style (Agriculture AI, Daily News - AI databases) —
//    title is BOLD AND a link, source attribution follows in parens:
//      ## [Category Name]
//        - [**Title**](url) ([source.com](http://source.com)) — Summary text
//
// A bulleted_list_item is treated as an article when it contains at least one
// bold segment (the title) AND at least one URL we can bookmark.

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
 *  1. Find the first bold segment (with or without link) → that's the title.
 *     If the bold segment also has a link, that link is the primary source URL.
 *  2. After the title, accumulate plain-text → summary, until the first
 *     non-title link appears (a source attribution like "(grainews.ca)")
 *  3. From there onward, collect URLs but ignore the parens/whitespace text
 *     between them
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBullet(richText: any[]): ParsedArticle | null {
  const segments = normalizeRichText(richText)
  const firstBoldIdx = segments.findIndex(s => s.bold)
  const firstLinkIdx = segments.findIndex(s => s.link)

  // Title-detection priority:
  //   1. First bold segment(s)               — Canada AI Daily, Agriculture
  //   2. First link segment(s) (no bold)     — Daily News - AI
  //   3. Otherwise: not an article
  let titleStartIdx: number
  let detectByLink = false
  if (firstBoldIdx !== -1) {
    titleStartIdx = firstBoldIdx
  } else if (firstLinkIdx !== -1) {
    titleStartIdx = firstLinkIdx
    detectByLink = true
  } else {
    return null
  }

  // Title: contiguous segments matching the detection criterion
  let title = ''
  const urls: string[] = []
  let i = titleStartIdx
  while (i < segments.length && (detectByLink ? !!segments[i].link : segments[i].bold)) {
    title += segments[i].text
    if (segments[i].link) urls.push(segments[i].link as string)
    i++
  }

  // After the title, summary text can sit in TWO places depending on format:
  //   • Canada AI Daily: summary BEFORE the first source link, citations after
  //   • Agriculture/Daily News: title-link first, citations next, summary AFTER
  // Track both candidates and pick the substantive one.
  let textBeforeFirstNonTitleLink = ''
  let textAfterLastLink = ''
  let sawNonTitleLink = false
  for (; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.link) {
      urls.push(seg.link)
      sawNonTitleLink = true
      textAfterLastLink = '' // reset — we're back inside citations
      continue
    }
    if (!sawNonTitleLink) textBeforeFirstNonTitleLink += seg.text
    else textAfterLastLink += seg.text
  }

  const before = cleanSummary(textBeforeFirstNonTitleLink)
  const after = cleanSummary(textAfterLastLink)
  // Pick whichever is substantive; prefer "before" when both exist (more common)
  const summary = before.length >= 30 ? before : (after.length >= 30 ? after : (before || after))

  return {
    title: title.trim().replace(/[.\s]+$/, '') || '(untitled)',
    summary,
    urls,
    rawText: segments.map(s => s.text).join(''),
  }
}

/** Strip leading/trailing punctuation, emoji-only fragments, dangling parens.
 *  Also strips a leading short parenthetical that looks like a source
 *  attribution — "(Reuters) — " or "(BBC) " — when it appears right at the
 *  start of the summary candidate. */
function cleanSummary(s: string): string {
  return s
    .replace(/\s*\(\s*\)\s*/g, ' ')                       // empty parens
    .replace(/\s+/g, ' ')                                 // collapse whitespace
    .trim()
    .replace(/^\s*\([^)]{1,40}\)\s*[—–-]?\s*/, '')        // leading "(Source) — " attribution
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u, '') // leading emoji run
    .replace(/^[\s\-–—()]+/, '')                          // leading dashes, parens, whitespace
    .replace(/\s*\(\s*$/, '')                             // dangling " (" before citations
    .trim()
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
