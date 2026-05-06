import { useState, useEffect } from 'react'
import { normalizeUrl } from '@/lib/url-normalize'

interface KnownTitle {
  title: string
  issueNumber: number
  issueDate: string
  published: boolean
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

function titleSimilarity(a: string, b: string): number {
  const aTokens = titleTokens(a)
  const bTokens = titleTokens(b)
  if (aTokens.size === 0 || bTokens.size === 0) return 0
  const overlap = [...aTokens].filter(token => bTokens.has(token)).length
  return overlap / Math.min(aTokens.size, bTokens.size)
}

export function useKnownUrls(password: string, days = 30) {
  const [urls, setUrls] = useState<Set<string>>(new Set())
  const [titles, setTitles] = useState<KnownTitle[]>([])
  const [windowDays, setWindowDays] = useState(days)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/known-urls?days=${days}`, {
          headers: { 'x-admin-password': password },
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setUrls(new Set<string>(data.urls ?? []))
        setTitles(Array.isArray(data.titles) ? data.titles : [])
        setWindowDays(data.windowDays ?? days)
      } catch {
        // Silent — dedup is a nice-to-have, not critical to the import flow
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [password, days])

  function isKnown(url: string | null | undefined): boolean {
    if (!url) return false
    return urls.has(normalizeUrl(url))
  }

  function findSimilarTitle(title: string): KnownTitle | null {
    let best: { entry: KnownTitle; score: number } | null = null
    for (const entry of titles) {
      const score = titleSimilarity(title, entry.title)
      if (score >= 0.62 && (!best || score > best.score)) {
        best = { entry, score }
      }
    }
    return best?.entry ?? null
  }

  return { urls, titles, windowDays, loaded, isKnown, findSimilarTitle }
}
