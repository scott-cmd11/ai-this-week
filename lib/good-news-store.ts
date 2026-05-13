import 'server-only'

import { GOOD_NEWS_SEED_STORIES } from '@/data/good-news-seed'
import type { GoodNewsDigest, GoodNewsStatus, GoodNewsStory } from './good-news-types'
import { dedupeGoodNewsStories } from './good-news-dedupe'
import { generateDailyDigest } from './good-news-digest'
import { isGoodNewsStoryCurrent } from './good-news-recency'

interface StoryRow {
  id: string
  title: string
  source_name: string
  source_url: string
  canonical_url: string
  published_at: string
  discovered_at: string
  summary: string
  why_it_matters: string
  category: GoodNewsStory['category']
  tags: string[]
  positivity_score: number
  credibility_score: number
  evidence_notes: string
  status: GoodNewsStatus
  created_at?: string
  updated_at?: string
}

interface DigestRow {
  id: string
  digest_date: string
  headline: string
  intro: string
  story_ids: string[]
  generated_at: string
}

const memoryStories = GOOD_NEWS_SEED_STORIES.map(story => ({ ...story, tags: [...story.tags] }))
let memoryDigest: GoodNewsDigest | null = generateDailyDigest(memoryStories)

export function isGoodNewsStoreConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

export async function listGoodNewsStories(options: {
  status?: GoodNewsStatus | GoodNewsStatus[]
  category?: string | null
  query?: string | null
  publishedWithinHours?: number
  now?: Date
  limit?: number
} = {}): Promise<GoodNewsStory[]> {
  const stories = await readStories()
  const statuses = Array.isArray(options.status)
    ? options.status
    : options.status
      ? [options.status]
      : null
  const query = options.query?.trim().toLowerCase()

  return stories
    .filter(story => !statuses || statuses.includes(story.status))
    .filter(story => !options.category || story.category === options.category)
    .filter(story => options.publishedWithinHours === undefined || isGoodNewsStoryCurrent(story, options.now, options.publishedWithinHours))
    .filter(story => !query || storySearchText(story).includes(query))
    .sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      || b.credibility_score - a.credibility_score
      || b.positivity_score - a.positivity_score
    )
    .slice(0, options.limit ?? 100)
}

export async function getGoodNewsStory(id: string): Promise<GoodNewsStory | null> {
  const stories = await readStories()
  return stories.find(story => story.id === id) ?? null
}

export async function upsertGoodNewsStories(stories: GoodNewsStory[]): Promise<GoodNewsStory[]> {
  const deduped = dedupeGoodNewsStories(stories)
  if (isGoodNewsStoreConfigured()) {
    try {
      const rows = await supabaseRequest<StoryRow[]>('ai_good_news_stories', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(deduped.map(storyToRow)),
      })
      return rows.map(rowToStory)
    } catch (err) {
      console.warn('AI Good News Supabase upsert failed; using in-memory store.', err)
    }
  }

  for (const story of deduped) {
    const index = memoryStories.findIndex(existing => existing.id === story.id || existing.canonical_url === story.canonical_url)
    if (index === -1) {
      memoryStories.push(story)
    } else {
      memoryStories[index] = { ...memoryStories[index], ...story }
    }
  }
  return deduped
}

export async function updateGoodNewsStory(
  id: string,
  patch: Partial<Omit<GoodNewsStory, 'id'>>,
): Promise<GoodNewsStory | null> {
  if (isGoodNewsStoreConfigured()) {
    try {
      const rows = await supabaseRequest<StoryRow[]>(`ai_good_news_stories?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(storyPatchToRow(patch)),
      })
      return rows[0] ? rowToStory(rows[0]) : null
    } catch (err) {
      console.warn('AI Good News Supabase update failed; using in-memory store.', err)
    }
  }

  const index = memoryStories.findIndex(story => story.id === id)
  if (index === -1) return null
  memoryStories[index] = { ...memoryStories[index], ...patch }
  return memoryStories[index]
}

export async function getLatestGoodNewsDigest(): Promise<GoodNewsDigest> {
  if (isGoodNewsStoreConfigured()) {
    try {
      const params = new URLSearchParams({
        select: '*',
        order: 'digest_date.desc',
        limit: '1',
      })
      const rows = await supabaseRequest<DigestRow[]>(`ai_good_news_digests?${params.toString()}`)
      if (rows[0]) return rowToDigest(rows[0])
    } catch (err) {
      console.warn('AI Good News Supabase digest read failed; using in-memory digest.', err)
    }
  }

  memoryDigest = memoryDigest ?? generateDailyDigest(memoryStories)
  return memoryDigest
}

export async function saveGoodNewsDigest(digest: GoodNewsDigest): Promise<GoodNewsDigest> {
  if (isGoodNewsStoreConfigured()) {
    try {
      const rows = await supabaseRequest<DigestRow[]>('ai_good_news_digests', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(digestToRow(digest)),
      })
      if (rows[0]) return rowToDigest(rows[0])
    } catch (err) {
      console.warn('AI Good News Supabase digest save failed; using in-memory digest.', err)
    }
  }

  memoryDigest = digest
  return digest
}

export async function generateAndSaveGoodNewsDigest(now = new Date()): Promise<GoodNewsDigest> {
  const stories = await listGoodNewsStories({ status: 'published', limit: 250 })
  return saveGoodNewsDigest(generateDailyDigest(stories, now))
}

async function readStories(): Promise<GoodNewsStory[]> {
  if (isGoodNewsStoreConfigured()) {
    try {
      const params = new URLSearchParams({
        select: '*',
        order: 'published_at.desc',
      })
      const rows = await supabaseRequest<StoryRow[]>(`ai_good_news_stories?${params.toString()}`)
      return rows.map(rowToStory)
    } catch (err) {
      console.warn('AI Good News Supabase read failed; using seeded in-memory data.', err)
    }
  }

  return memoryStories
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured.')
  return { url: url.replace(/\/$/, ''), key }
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = getSupabaseConfig()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase request failed (${res.status}): ${body || res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function rowToStory(row: StoryRow): GoodNewsStory {
  return {
    id: row.id,
    title: row.title,
    source_name: row.source_name,
    source_url: row.source_url,
    canonical_url: row.canonical_url,
    published_at: row.published_at,
    discovered_at: row.discovered_at,
    summary: row.summary,
    why_it_matters: row.why_it_matters,
    category: row.category,
    tags: row.tags ?? [],
    positivity_score: row.positivity_score,
    credibility_score: row.credibility_score,
    evidence_notes: row.evidence_notes,
    status: row.status,
  }
}

function storyToRow(story: GoodNewsStory): StoryRow {
  return { ...story }
}

function storyPatchToRow(patch: Partial<Omit<GoodNewsStory, 'id'>>): Partial<StoryRow> {
  return { ...patch }
}

function digestToRow(digest: GoodNewsDigest): DigestRow {
  return {
    id: digest.id,
    digest_date: digest.date,
    headline: digest.headline,
    intro: digest.intro,
    story_ids: digest.story_ids,
    generated_at: digest.generated_at,
  }
}

function rowToDigest(row: DigestRow): GoodNewsDigest {
  return {
    id: row.id,
    date: row.digest_date,
    headline: row.headline,
    intro: row.intro,
    story_ids: row.story_ids ?? [],
    generated_at: row.generated_at,
  }
}

function storySearchText(story: GoodNewsStory): string {
  return [
    story.title,
    story.source_name,
    story.summary,
    story.why_it_matters,
    story.category,
    story.evidence_notes,
    ...story.tags,
  ].join(' ').toLowerCase()
}
