import type { Issue } from '@/lib/types'

interface Props {
  issue: Issue
  baseUrl: string
  description?: string
}

/**
 * Emits a NewsArticle JSON-LD block for SEO. Enables Google rich-results
 * (date, image, publisher) on search result pages.
 */
export function ArticleJsonLd({ issue, baseUrl, description }: Props) {
  const url = `${baseUrl}/issues/${issue.slug}`
  const imageUrl = `${url}/opengraph-image`
  const isoDate = new Date(issue.issueDate + 'T12:00:00Z').toISOString()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: issue.title,
    description: description || issue.summary || undefined,
    datePublished: isoDate,
    dateModified: isoDate,
    url,
    image: [imageUrl],
    author: {
      '@type': 'Organization',
      name: 'AI Today',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AI Today',
      url: baseUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  }

  // Escape `<` to prevent premature </script> closure on any injected string value.
  const serialized = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <script
      id={`jsonld-issue-${issue.id}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  )
}
