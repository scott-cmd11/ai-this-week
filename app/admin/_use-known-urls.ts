import { useState, useEffect } from 'react'
import { normalizeUrl } from '@/lib/url-normalize'
import { findSimilarTitle as findSimilarTitleMatch } from '@/lib/title-dedupe'

interface KnownTitle {
  title: string
  issueNumber: number
  issueDate: string
  published: boolean
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
    return findSimilarTitleMatch(title, titles)
  }

  return { urls, titles, windowDays, loaded, isKnown, findSimilarTitle }
}
