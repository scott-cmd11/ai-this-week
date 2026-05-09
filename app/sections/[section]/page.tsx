import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS, getArticlesBySection } from '@/lib/issue-store'
import type { SectionSlug } from '@/lib/issue-store'

export const revalidate = 3600

interface Props {
  params: Promise<{ section: string }>
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export async function generateStaticParams() {
  return SECTIONS.map(s => ({ section: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params
  const meta = SECTIONS.find(s => s.slug === section)
  if (!meta) return {}
  return {
    title: meta.label,
    description: `All ${meta.label} coverage from AI Today.`,
    alternates: {
      canonical: `/sections/${meta.slug}`,
    },
  }
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params
  const meta = SECTIONS.find(s => s.slug === (section as SectionSlug))
  if (!meta) notFound()

  const articles = await getArticlesBySection(meta.keyword)

  return (
    <>
      <div className="mb-4">
        <Link
          href="/sections"
          className="type-meta border-b border-transparent no-underline hover:border-ws-accent"
        >
          &lt;- All sections
        </Link>
      </div>

      <h1 className="type-page-title mt-4 mb-2">
        <span className="type-meta mr-3 align-middle border border-ws-border bg-[#fffaf0] px-2.5 py-1 text-[11px] text-ws-accent" aria-hidden="true">
          {meta.code}
        </span>
        {meta.label}
      </h1>
      <div className="section-rule mb-6" aria-hidden="true" />
      <p className="type-meta mb-10">
        {articles.length} pick{articles.length === 1 ? '' : 's'} across all issues
      </p>

      {articles.length === 0 ? (
        <div className="border-y border-ws-border py-6">
          <p className="type-card-title">No articles found in this section yet.</p>
        </div>
      ) : (
        <ul className="list-none divide-y divide-ws-border border-y border-ws-border p-0">
          {articles.map((article, i) => (
            <li key={i}>
              <article className="py-6">
                <div className="type-meta mb-2 flex gap-3">
                  <Link
                    href={`/issues/${article.issueSlug}`}
                    className="underline hover:no-underline hover:text-ws-accent"
                  >
                    Issue {article.issueNumber}
                  </Link>
                  <span aria-hidden="true">/</span>
                  <time dateTime={article.issueDate}>{formatDate(article.issueDate)}</time>
                </div>

                {article.articleTitle && (
                  <h2 className="mb-3 max-w-3xl font-[family-name:var(--font-display)] text-[1.65rem] font-medium leading-tight text-ws-black">
                    {article.articleUrl ? (
                      <a
                        href={article.articleUrl}
                        className="text-ws-black no-underline hover:text-ws-accent"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {article.articleTitle}
                        <span className="sr-only"> (opens in new tab)</span>
                      </a>
                    ) : (
                      article.articleTitle
                    )}
                  </h2>
                )}

                {article.summary && (
                  <p className="max-w-3xl text-[16px] leading-[1.65] text-ws-muted">{article.summary}</p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
