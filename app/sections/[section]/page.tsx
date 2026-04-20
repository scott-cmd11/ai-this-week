import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS, getArticlesBySection } from '@/lib/notion'
import type { SectionSlug } from '@/lib/notion'

export const revalidate = 3600  // expensive: fetches all issue blocks

interface Props {
  params: Promise<{ section: string }>
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
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
    title: `${meta.label} | AI This Week`,
    description: `All ${meta.label} picks from AI This Week.`,
  }
}

export default async function SectionPage({ params }: Props) {
  const { section } = await params
  const meta = SECTIONS.find(s => s.slug === (section as SectionSlug))
  if (!meta) notFound()

  const articles = await getArticlesBySection(meta.keyword)

  return (
    <>
      <div className="mb-2">
        <Link href="/sections" className="text-[14px] text-govuk-blue underline hover:no-underline">
          ← All sections
        </Link>
      </div>

      <h1 className="text-[48px] font-bold text-govuk-black dark:text-white leading-tight mt-4 mb-2">
        <span aria-hidden="true">{meta.emoji} </span>{meta.label}
      </h1>
      <p className="text-[17px] text-govuk-dark-grey dark:text-govuk-light-grey mb-10">
        {articles.length} pick{articles.length === 1 ? '' : 's'} across all issues
      </p>

      {articles.length === 0 ? (
        <p className="text-[19px] text-govuk-dark-grey">No articles found in this section yet.</p>
      ) : (
        <ul className="space-y-8 list-none p-0">
          {articles.map((article, i) => (
            <li key={i} className="border-b border-govuk-mid-grey pb-6">
              {/* Issue attribution */}
              <div className="flex gap-3 text-[14px] text-govuk-dark-grey mb-2">
                <Link
                  href={`/issues/${article.issueSlug}`}
                  className="text-govuk-blue underline hover:no-underline font-bold"
                >
                  Issue {article.issueNumber}
                </Link>
                <span aria-hidden="true">·</span>
                <time dateTime={article.issueDate}>{formatDate(article.issueDate)}</time>
              </div>

              {/* Article title */}
              {article.articleTitle && (
                <h2 className="text-[22px] font-bold text-govuk-black dark:text-white leading-tight mb-2">
                  {article.articleUrl ? (
                    <a
                      href={article.articleUrl}
                      className="text-govuk-blue underline hover:text-govuk-black"
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

              {/* Summary */}
              {article.summary && (
                <p className="text-[17px] text-govuk-black dark:text-white leading-[1.5]">{article.summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
