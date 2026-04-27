// ─── AI annotation helper ───────────────────────────────────────────────────────
// Single source of truth for "fetch a URL + ask GPT to write an AI Today
// annotation in the AI Today voice." Used by /api/capture (when the user
// doesn't supply a note) and by /api/import-briefing-articles (when the user
// opts to rewrite briefing summaries in the AI Today voice).
//
// Voice rules live in lib/prompts.ts so every code path that produces
// user-facing text shares one definition of "AI Today voice."

import type OpenAI from 'openai'
import { fetchArticle, hostnameFallback } from './article-fetcher'
import { SYSTEM_PROMPTS } from './prompts'

interface GenerateOptions {
  /**
   * Pre-existing summary text (e.g. from a Notion briefing). When the URL
   * fetch returns nothing usable, we fall back to this text — letting the
   * model rewrite an existing summary instead of inventing one from a title.
   */
  fallbackSummary?: string | null
  /** Pre-fetched title; if provided, we skip re-fetching. */
  knownTitle?: string | null
}

/**
 * Generate an annotation for a URL using OpenAI.
 * Returns the annotation text, or '[Add annotation]' if everything fails.
 *
 * Order of attempts:
 *   1. Fetch the article body, ask GPT to summarize it
 *   2. If fetch returned no body but a fallbackSummary was provided,
 *      ask GPT to rewrite the fallback summary in the AI Today voice
 *   3. Last resort: return '[Add annotation]'
 */
export async function generateAnnotation(
  openai: OpenAI,
  url: string,
  opts: GenerateOptions = {},
): Promise<string> {
  let title = opts.knownTitle ?? null
  let articleText = ''

  try {
    const fetched = await fetchArticle(url)
    title = title ?? fetched.title
    articleText = fetched.text ? fetched.text.slice(0, 3000) : ''
  } catch {
    // Network/parse failure — fall through with whatever we have
  }

  // Pick the source text the model will work from
  let sourceText = articleText
  if (!sourceText && opts.fallbackSummary) {
    sourceText = opts.fallbackSummary.slice(0, 3000)
  }

  if (!sourceText) {
    // Nothing to summarize from
    return opts.fallbackSummary?.trim() || '[Add annotation]'
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        // System prompt = the central AI Today voice guide (1–2 sentences,
        // plain language, no jargon, active verbs, no hedges).
        { role: 'system', content: SYSTEM_PROMPTS.brief },
        {
          role: 'user',
          content:
            `Title: ${title ?? hostnameFallback(url)}\n` +
            `URL: ${url}\n\nArticle text:\n${sourceText}`,
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ||
      opts.fallbackSummary?.trim() ||
      '[Add annotation]'
  } catch {
    return opts.fallbackSummary?.trim() || '[Add annotation]'
  }
}
