import type { GoodNewsDigest, GoodNewsStory } from './good-news-types'
import { dedupeGoodNewsStories } from './good-news-dedupe'
import { isHighRelevanceGoodNewsStory, storyQualityScore } from './good-news-scoring'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS, GOOD_NEWS_FALLBACK_WINDOW_HOURS, goodNewsDateId, isGoodNewsStoryCurrent } from './good-news-recency'

export function generateDailyDigest(stories: GoodNewsStory[], now = new Date()): GoodNewsDigest {
  const date = goodNewsDateId(now)
  const eligibleStories = stories.filter(story =>
    story.status === 'published'
    && isHighRelevanceGoodNewsStory(story)
  )
  const currentStories = eligibleStories.filter(story => isGoodNewsStoryCurrent(story, now, GOOD_NEWS_CURRENT_WINDOW_HOURS))
  const expandedToFallback = currentStories.length === 0
  const digestSourceStories = expandedToFallback
    ? eligibleStories.filter(story => isGoodNewsStoryCurrent(story, now, GOOD_NEWS_FALLBACK_WINDOW_HOURS))
    : currentStories
  const topStories = rankDigestStories(digestSourceStories, now).slice(0, 10)
  const categories = Array.from(new Set(topStories.map(story => story.category)))
  const windowLabel = expandedToFallback ? 'last 48 hours' : 'last 24 hours'

  return {
    id: `digest-${date}`,
    date,
    headline: topStories.length > 0
      ? `Today in AI Good News: ${categories.slice(0, 3).join(', ')}`
      : 'Today in AI Good News',
    intro: topStories.length > 0
      ? `A concise scan of ${topStories.length} positive, source-linked AI stories from the ${windowLabel} across ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}.`
      : 'No source-linked AI Good News stories from the last 48 hours are available for this digest yet.',
    story_ids: topStories.map(story => story.id),
    generated_at: now.toISOString(),
  }
}

export function rankDigestStories(stories: GoodNewsStory[], now = new Date()): GoodNewsStory[] {
  const deduped = dedupeGoodNewsStories(stories)
  const selected: GoodNewsStory[] = []
  const remaining = [...deduped].sort((a, b) => storyQualityScore(b, now) - storyQualityScore(a, now))
  const categoryCounts = new Map<string, number>()

  while (remaining.length > 0) {
    remaining.sort((a, b) =>
      adjustedScore(b, categoryCounts, now) - adjustedScore(a, categoryCounts, now)
      || new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      || a.title.localeCompare(b.title)
    )
    const next = remaining.shift()
    if (!next) break
    selected.push(next)
    categoryCounts.set(next.category, (categoryCounts.get(next.category) ?? 0) + 1)
  }

  return selected
}

function adjustedScore(story: GoodNewsStory, categoryCounts: Map<string, number>, now: Date): number {
  const diversityPenalty = (categoryCounts.get(story.category) ?? 0) * 8
  return storyQualityScore(story, now) - diversityPenalty
}
