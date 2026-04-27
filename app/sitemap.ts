import type { MetadataRoute } from 'next'
import { getPublishedIssues, SECTIONS } from '@/lib/notion'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

  const issues = await getPublishedIssues()
  const now = new Date()

  return [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/issues`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/sections`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    ...SECTIONS.map(s => ({
      url: `${BASE_URL}/sections/${s.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    ...issues.map(issue => ({
      url: `${BASE_URL}/issues/${issue.slug}`,
      lastModified: new Date(issue.issueDate + 'T12:00:00Z'),
      changeFrequency: 'yearly' as const,
      priority: 0.9,
    })),
  ]
}
