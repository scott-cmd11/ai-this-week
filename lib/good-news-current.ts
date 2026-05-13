import 'server-only'

import { dedupeGoodNewsStories } from './good-news-dedupe'
import { ingestConfiguredGoodNewsSources } from './good-news-ingestion'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS, isGoodNewsStoryCurrent } from './good-news-recency'
import { isHighRelevanceGoodNewsStory } from './good-news-scoring'
import { getGoodNewsStory, listGoodNewsStories } from './good-news-store'
import type { GoodNewsCategory, GoodNewsStory } from './good-news-types'

const LIVE_SUPPLEMENT_TTL_MS = 5 * 60 * 1000
const LIVE_SUPPLEMENT_TARGET = 8

let liveSupplementCache:
  | {
    fetchedAt: number
    stories: GoodNewsStory[]
  }
  | null = null

export async function listCurrentPublishedGoodNewsStories(options: {
  category?: GoodNewsCategory | null
  query?: string | null
  now?: Date
  limit?: number
  targetCount?: number
} = {}): Promise<GoodNewsStory[]> {
  const now = options.now ?? new Date()
  const stored = await listGoodNewsStories({
    status: 'published',
    publishedWithinHours: GOOD_NEWS_CURRENT_WINDOW_HOURS,
    now,
    limit: 250,
  })

  const needsSupplement = stored.length < (options.targetCount ?? LIVE_SUPPLEMENT_TARGET)
  const supplement = needsSupplement ? await getLiveSupplementStories(now) : []
  const query = options.query?.trim().toLowerCase()

  return dedupeGoodNewsStories([...stored, ...supplement])
    .filter(story => story.status === 'published')
    .filter(story => isGoodNewsStoryCurrent(story, now, GOOD_NEWS_CURRENT_WINDOW_HOURS))
    .filter(isHighRelevanceGoodNewsStory)
    .filter(story => !options.category || story.category === options.category)
    .filter(story => !query || storySearchText(story).includes(query))
    .sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      || b.credibility_score - a.credibility_score
      || b.positivity_score - a.positivity_score
    )
    .slice(0, options.limit ?? 100)
}

export async function getCurrentPublishedGoodNewsStory(id: string, now = new Date()): Promise<GoodNewsStory | null> {
  const stored = await getGoodNewsStory(id)
  if (
    stored?.status === 'published'
    && isGoodNewsStoryCurrent(stored, now, GOOD_NEWS_CURRENT_WINDOW_HOURS)
    && isHighRelevanceGoodNewsStory(stored)
  ) {
    return stored
  }

  const supplement = await getLiveSupplementStories(now)
  return supplement.find(story => story.id === id) ?? null
}

async function getLiveSupplementStories(now: Date): Promise<GoodNewsStory[]> {
  const cached = liveSupplementCache
  if (cached && Date.now() - cached.fetchedAt < LIVE_SUPPLEMENT_TTL_MS) {
    return cached.stories
  }

  try {
    const result = await ingestConfiguredGoodNewsSources({
      persist: false,
      status: 'published',
      limitPerSource: 18,
    })
    const stories = result.stories
      .filter(story => story.status === 'published')
      .filter(story => isGoodNewsStoryCurrent(story, now, GOOD_NEWS_CURRENT_WINDOW_HOURS))
      .filter(isHighRelevanceGoodNewsStory)

    liveSupplementCache = {
      fetchedAt: Date.now(),
      stories,
    }
    return stories
  } catch (err) {
    console.warn('AI Good News live supplement failed.', err)
    liveSupplementCache = {
      fetchedAt: Date.now(),
      stories: [],
    }
    return []
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
