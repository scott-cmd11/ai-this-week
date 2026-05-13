import type { GoodNewsStory } from './good-news-types'

export const GOOD_NEWS_CURRENT_WINDOW_HOURS = 24

export function isGoodNewsStoryCurrent(
  story: Pick<GoodNewsStory, 'published_at'> | { published_at?: string | null },
  now = new Date(),
  windowHours = GOOD_NEWS_CURRENT_WINDOW_HOURS,
): boolean {
  return hoursSincePublished(story.published_at, now) <= windowHours
}

export function hoursSincePublished(publishedAt: string | null | undefined, now = new Date()): number {
  if (!publishedAt) return Number.POSITIVE_INFINITY
  const published = new Date(publishedAt)
  if (Number.isNaN(published.getTime())) return Number.POSITIVE_INFINITY
  return Math.max(0, (now.getTime() - published.getTime()) / 3_600_000)
}

export function goodNewsDateId(date: Date): string {
  return date.toISOString().slice(0, 10)
}
