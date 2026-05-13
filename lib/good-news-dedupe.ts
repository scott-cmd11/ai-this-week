import type { GoodNewsStory } from './good-news-types'
import { normalizeGoodNewsUrl } from './good-news-scoring'

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'uses',
  'using',
  'artificial',
  'intelligence',
  'about',
  'more',
  'new',
])

export function dedupeGoodNewsStories<T extends Pick<GoodNewsStory, 'title' | 'canonical_url' | 'source_url'>>(stories: T[]): T[] {
  const accepted: T[] = []
  const seenUrls = new Set<string>()

  for (const story of stories) {
    const url = normalizeGoodNewsUrl(story.canonical_url || story.source_url)
    if (seenUrls.has(url)) continue
    if (accepted.some(existing => areSimilarGoodNewsStories(existing, story))) continue
    seenUrls.add(url)
    accepted.push(story)
  }

  return accepted
}

export function areSimilarGoodNewsStories(
  a: Pick<GoodNewsStory, 'title' | 'canonical_url' | 'source_url'>,
  b: Pick<GoodNewsStory, 'title' | 'canonical_url' | 'source_url'>,
): boolean {
  const aUrl = normalizeGoodNewsUrl(a.canonical_url || a.source_url)
  const bUrl = normalizeGoodNewsUrl(b.canonical_url || b.source_url)
  if (aUrl === bUrl) return true

  const aTokens = titleTokens(a.title)
  const bTokens = titleTokens(b.title)
  if (aTokens.size < 4 || bTokens.size < 4) return false

  let overlap = 0
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++
  }
  return overlap / Math.min(aTokens.size, bTokens.size) >= 0.72
}

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !STOP_WORDS.has(token)),
  )
}
