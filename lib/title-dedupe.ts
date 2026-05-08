export interface ComparableTitle {
  title: string
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'will', 'about',
  'after', 'over', 'under', 'using', 'amid', 'says', 'announces', 'announced',
  'launches', 'raises', 'investment', 'invests', 'expand', 'expands', 'ai',
])

function titleTokens(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))

  return new Set(normalized)
}

export function titleSimilarity(a: string, b: string): number {
  const aTokens = titleTokens(a)
  const bTokens = titleTokens(b)
  if (aTokens.size === 0 || bTokens.size === 0) return 0

  const overlap = [...aTokens].filter(token => bTokens.has(token)).length
  return overlap / Math.min(aTokens.size, bTokens.size)
}

export function findSimilarTitle<T extends ComparableTitle>(
  title: string,
  candidates: T[],
  threshold = 0.6,
): T | null {
  let best: { entry: T; score: number } | null = null

  for (const entry of candidates) {
    const score = titleSimilarity(title, entry.title)
    if (score >= threshold && (!best || score > best.score)) {
      best = { entry, score }
    }
  }

  return best?.entry ?? null
}
