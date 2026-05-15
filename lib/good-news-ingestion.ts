import 'server-only'

import sourceConfig from '@/config/ai-good-news-sources.json'
import type { GoodNewsCandidateInput, GoodNewsSourceConfig, GoodNewsStatus, GoodNewsStory } from './good-news-types'
import { createGoodNewsSummarizer } from './good-news-summarizer'
import { normalizeGoodNewsUrl } from './good-news-scoring'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS, GOOD_NEWS_FALLBACK_WINDOW_HOURS, isGoodNewsStoryCurrent } from './good-news-recency'
import { parseRssItems, type RssItem } from './good-news-rss'
import { upsertGoodNewsStories } from './good-news-store'

export interface GoodNewsIngestionResult {
  checkedSources: number
  fetchedItems: number
  accepted: number
  acceptedInPrimaryWindow: number
  rejected: number
  stories: GoodNewsStory[]
  errors: string[]
  lookbackWindowHours: number
  expandedToFallback: boolean
}

export async function ingestConfiguredGoodNewsSources(options: {
  persist?: boolean
  status?: GoodNewsStatus
  limitPerSource?: number
  lookbackHours?: number
  fallbackLookbackHours?: number
  minimumAccepted?: number
} = {}): Promise<GoodNewsIngestionResult> {
  const sources = (sourceConfig as GoodNewsSourceConfig[]).filter(source => source.enabled)
  const summarizer = createGoodNewsSummarizer()
  const acceptedStories: GoodNewsStory[] = []
  const errors: string[] = []
  const now = new Date()
  const status = options.status ?? 'pending'
  const limitPerSource = options.limitPerSource ?? 12
  const primaryLookbackHours = options.lookbackHours ?? GOOD_NEWS_CURRENT_WINDOW_HOURS
  const fallbackLookbackHours = options.fallbackLookbackHours ?? GOOD_NEWS_FALLBACK_WINDOW_HOURS
  const maximumLookbackHours = Math.max(primaryLookbackHours, fallbackLookbackHours)
  const minimumAccepted = options.minimumAccepted ?? 1
  let fetchedItems = 0
  let rejected = 0

  for (const source of sources) {
    try {
      const items = await fetchRssItems(source)
      fetchedItems += items.length
      for (const item of items.slice(0, limitPerSource)) {
        if (!isGoodNewsStoryCurrent({ published_at: item.publishedAt }, now, maximumLookbackHours)) {
          rejected++
          continue
        }
        const sourceName = item.sourceName || source.name
        const input: GoodNewsCandidateInput = {
          title: item.title,
          source_name: sourceName,
          source_url: item.link,
          canonical_url: item.link,
          published_at: item.publishedAt,
          discovered_at: now.toISOString(),
          summary: item.description,
          content_text: item.description,
          category: source.default_category,
        }
        const summary = await summarizer.summarize(input)
        if (!summary.accepted) {
          rejected++
          continue
        }
        acceptedStories.push({
          id: storyIdForUrl(item.link),
          title: item.title,
          source_name: sourceName,
          source_url: item.link,
          canonical_url: normalizeGoodNewsUrl(item.link),
          published_at: item.publishedAt ?? new Date().toISOString(),
          discovered_at: input.discovered_at!,
          summary: summary.summary,
          why_it_matters: summary.why_it_matters,
          category: summary.category,
          tags: summary.tags,
          positivity_score: summary.positivity_score,
          credibility_score: summary.credibility_score,
          evidence_notes: summary.evidence_notes,
          status,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown ingestion error'
      errors.push(`${source.name}: ${message}`)
    }
  }

  const primaryStories = acceptedStories.filter(story => isGoodNewsStoryCurrent(story, now, primaryLookbackHours))
  const expandedToFallback = primaryStories.length < minimumAccepted
  const selectedStories = expandedToFallback
    ? acceptedStories.filter(story => isGoodNewsStoryCurrent(story, now, fallbackLookbackHours))
    : primaryStories
  const saved = options.persist === false ? selectedStories : await upsertGoodNewsStories(selectedStories)

  return {
    checkedSources: sources.length,
    fetchedItems,
    accepted: saved.length,
    acceptedInPrimaryWindow: primaryStories.length,
    rejected,
    stories: saved,
    errors,
    lookbackWindowHours: expandedToFallback ? fallbackLookbackHours : primaryLookbackHours,
    expandedToFallback,
  }
}

async function fetchRssItems(source: GoodNewsSourceConfig): Promise<RssItem[]> {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': 'AI Good News MVP RSS reader (respectful RSS fetch; contact site owner if needed)',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RSS fetch failed with ${res.status}`)
  const xml = await res.text()
  return parseRssItems(xml)
}

function storyIdForUrl(url: string): string {
  const normalized = normalizeGoodNewsUrl(url)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0
  }
  return `rss-${Math.abs(hash).toString(36)}`
}
