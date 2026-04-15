import type { MetadataRoute } from 'next'
import { getPublishedIssues } from '@/lib/notion'

export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

  const issues = await getPublishedIssues()

  return [
    { url: `${BASE_URL}/`, lastModified: new Date() },
    { url: `${BASE_URL}/issues`, lastModified: new Date() },
    { url: `${BASE_URL}/about`, lastModified: new Date() },
    ...issues.map(issue => ({
      url: `${BASE_URL}/issues/${issue.slug}`,
      lastModified: new Date(issue.issueDate + 'T12:00:00Z'),
    })),
  ]
}
