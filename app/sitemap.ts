import type { MetadataRoute } from 'next'
import { getPublishedIssues, SECTIONS } from '@/lib/issue-store'
import { listGoodNewsStories } from '@/lib/good-news-store'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS } from '@/lib/good-news-recency'
import { SITE_URL } from '@/lib/site'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [issues, goodNewsStories] = await Promise.all([
    getPublishedIssues(),
    listGoodNewsStories({
      status: 'published',
      publishedWithinHours: GOOD_NEWS_CURRENT_WINDOW_HOURS,
      now,
      limit: 200,
    }),
  ])

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/positive-ai`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/positive-ai/archive`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/positive-ai/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/issues`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/sections`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ...SECTIONS.map(s => ({
      url: `${SITE_URL}/sections/${s.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...issues.map(issue => ({
      url: `${SITE_URL}/issues/${issue.slug}`,
      lastModified: new Date(issue.issueDate + 'T12:00:00Z'),
      changeFrequency: 'yearly' as const,
      priority: 0.9,
    })),
    ...goodNewsStories.map(story => ({
      url: `${SITE_URL}/positive-ai/stories/${story.id}`,
      lastModified: new Date(story.published_at),
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    })),
  ]
}
