import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SECTIONS, getArticlesBySection } from '@/lib/notion'
import type { SectionSlug } from '@/lib/notion'
import { NeoPopCard } from '@/components/NeoPop/NeoPopCard'

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
      <div className="mb-4">
        <Link
          href="/sections"
          className="text-[14px] font-black uppercase tracking-wide no-underline border-b-[3px] border-transparent hover:border-neopop-red"
        >
          ← All sections
        </Link>
      </div>

      <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight mt-4 mb-2">
        <span aria-hidden="true">{meta.emoji} </span>{meta.label}
      </h1>
      <div className="w-20 h-[6px] bg-neopop-red mb-6" aria-hidden="true" />
      <p className="text-[15px] font-bold uppercase tracking-wide mb-10">
        {articles.length} pick{articles.length === 1 ? '' : 's'} across all issues
      </p>

      {articles.length === 0 ? (
        <NeoPopCard bg="white" interactive={false}>
          <p className="text-[19px] font-bold">No articles found in this section yet.</p>
        </NeoPopCard>
      ) : (
        <ul className="space-y-10 list-none p-0">
          {articles.map((article, i) => (
            <li key={i}>
              <NeoPopCard bg="white" interactive={false}>
                {/* Issue attribution */}
                <div className="flex gap-3 text-[13px] font-bold uppercase tracking-wide mb-2">
                  <Link
                    href={`/issues/${article.issueSlug}`}
                    className="underline hover:no-underline hover:text-neopop-red"
                  >
                    Issue {article.issueNumber}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <time dateTime={article.issueDate}>{formatDate(article.issueDate)}</time>
                </div>

                {/* Article title */}
                {article.articleTitle && (
                  <h2 className="text-[22px] font-black leading-tight mb-3 text-neopop-black">
                    {article.articleUrl ? (
                      <a
                        href={article.articleUrl}
                        className="text-neopop-black hover:text-neopop-red underline hover:no-underline"
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
                  <p className="text-[17px] leading-[1.5]">{article.summary}</p>
                )}
              </NeoPopCard>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
