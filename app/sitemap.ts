import type { MetadataRoute } from 'next'
import { getPublishedIssues, SECTIONS } from '@/lib/issue-store'
import { SITE_URL } from '@/lib/site'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const issues = await getPublishedIssues()
  const now = new Date()

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
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
  ]
}
