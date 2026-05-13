import 'server-only'

import sourceConfig from '@/config/ai-good-news-sources.json'
import type { GoodNewsCandidateInput, GoodNewsSourceConfig, GoodNewsStory } from './good-news-types'
import { createGoodNewsSummarizer } from './good-news-summarizer'
import { normalizeGoodNewsUrl } from './good-news-scoring'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS, isGoodNewsStoryCurrent } from './good-news-recency'
import { upsertGoodNewsStories } from './good-news-store'

interface RssItem {
  title: string
  link: string
  publishedAt: string | null
  description: string
}

export interface GoodNewsIngestionResult {
  checkedSources: number
  fetchedItems: number
  accepted: number
  rejected: number
  stories: GoodNewsStory[]
  errors: string[]
}

export async function ingestConfiguredGoodNewsSources(options: { persist?: boolean } = {}): Promise<GoodNewsIngestionResult> {
  const sources = (sourceConfig as GoodNewsSourceConfig[]).filter(source => source.enabled)
  const summarizer = createGoodNewsSummarizer()
  const stories: GoodNewsStory[] = []
  const errors: string[] = []
  const now = new Date()
  let fetchedItems = 0
  let rejected = 0

  for (const source of sources) {
    try {
      const items = await fetchRssItems(source)
      fetchedItems += items.length
      for (const item of items.slice(0, 12)) {
        if (!isGoodNewsStoryCurrent({ published_at: item.publishedAt }, now, GOOD_NEWS_CURRENT_WINDOW_HOURS)) {
          rejected++
          continue
        }
        const input: GoodNewsCandidateInput = {
          title: item.title,
          source_name: source.name,
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
        stories.push({
          id: storyIdForUrl(item.link),
          title: item.title,
          source_name: source.name,
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
          status: 'pending',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown ingestion error'
      errors.push(`${source.name}: ${message}`)
    }
  }

  const saved = options.persist === false ? stories : await upsertGoodNewsStories(stories)

  return {
    checkedSources: sources.length,
    fetchedItems,
    accepted: saved.length,
    rejected,
    stories: saved,
    errors,
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

export function parseRssItems(xml: string): RssItem[] {
  const itemMatches = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  const entryMatches = itemMatches.length > 0 ? itemMatches : [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
  return entryMatches.map(match => {
    const item = match[0]
    const link = readTag(item, 'link') || readAtomLink(item)
    return {
      title: decodeXml(readTag(item, 'title')),
      link: decodeXml(link),
      publishedAt: normalizeRssDate(readTag(item, 'pubDate') || readTag(item, 'published') || readTag(item, 'updated')),
      description: stripHtml(decodeXml(readTag(item, 'description') || readTag(item, 'summary') || readTag(item, 'content:encoded'))),
    }
  }).filter(item => item.title && item.link)
}

function readTag(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
  return match?.[1]?.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() ?? ''
}

function readAtomLink(xml: string): string {
  const href = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1]
  return href?.trim() ?? ''
}

function normalizeRssDate(value: string): string | null {
  if (!value) return null
  const parsed = new Date(decodeXml(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim()
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function storyIdForUrl(url: string): string {
  const normalized = normalizeGoodNewsUrl(url)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0
  }
  return `rss-${Math.abs(hash).toString(36)}`
}
