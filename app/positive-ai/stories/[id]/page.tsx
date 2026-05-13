import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentPublishedGoodNewsStory, listCurrentPublishedGoodNewsStories } from '@/lib/good-news-current'

export const revalidate = 300

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const story = await getCurrentPublishedGoodNewsStory(id)
  if (!story) return {}
  return {
    title: story.title,
    description: story.summary,
    alternates: {
      canonical: `/positive-ai/stories/${story.id}`,
    },
  }
}

export default async function GoodNewsStoryPage({ params }: Props) {
  const { id } = await params
  const story = await getCurrentPublishedGoodNewsStory(id)
  if (!story) notFound()

  const related = (await listCurrentPublishedGoodNewsStories({
    category: story.category,
    limit: 4,
  }))
    .filter(candidate => candidate.id !== story.id)
    .slice(0, 3)

  return (
    <>
      <div className="mb-4">
        <Link href="/positive-ai" className="type-meta border-b border-transparent no-underline hover:border-ws-accent">
          &lt;- AI Good News
        </Link>
      </div>

      <article className="border-t border-ws-black pt-7">
        <header className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <p className="type-meta mb-4 text-ws-accent">{story.category}</p>
            <h1 className="type-page-title max-w-5xl">{story.title}</h1>
            <p className="mt-5 max-w-3xl text-[20px] leading-[1.55] text-ws-muted">
              {story.summary}
            </p>
          </div>

          <aside className="border-y border-ws-border py-4" aria-label="Story file">
            <p className="type-meta text-ws-accent">Story file</p>
            <dl className="mt-4 grid divide-y divide-ws-border border-y border-ws-border">
              <Metric label="Credibility" value={`${story.credibility_score}/100`} />
              <Metric label="Positivity" value={`${story.positivity_score}/100`} />
              <Metric label="Published" value={formatDate(story.published_at)} />
              <Metric label="Source" value={story.source_name} />
            </dl>
            <p className="mt-4 text-[13px] leading-[1.5] text-ws-muted">
              Credibility weighs source quality, source links, and evidence signals. Positivity weighs clear beneficial AI use and excludes fear, market, or job-loss framing.
            </p>
            <Link href="/positive-ai/about#scoring" className="type-button mt-3 inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover">
              How scoring works
            </Link>
          </aside>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="grid gap-8">
            <div className="border-y border-ws-border py-6">
              <p className="type-meta text-ws-accent">Why this matters</p>
              <p className="mt-3 max-w-3xl text-[18px] leading-[1.6] text-ws-black">{story.why_it_matters}</p>
            </div>

            <div className="border-y border-ws-border py-6">
              <p className="type-meta text-ws-accent">Evidence check</p>
              <p className="mt-3 max-w-3xl text-[16px] leading-[1.65] text-ws-muted">{story.evidence_notes}</p>
              <p className="mt-5">
                <a
                  href={story.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-button inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover"
                >
                  Open original source
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </p>
            </div>
          </div>

          <aside className="border-t border-ws-border pt-5" aria-label="Tags">
            <p className="type-meta text-ws-accent">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {story.tags.map(tag => (
                <span key={tag} className="type-meta border border-ws-border bg-ws-elevated px-2.5 py-1 text-ws-muted">
                  {tag}
                </span>
              ))}
            </div>
          </aside>
        </section>
      </article>

      {related.length > 0 && (
        <section aria-label="Related good news" className="mt-12 border-t border-ws-black pt-5">
          <p className="type-meta text-ws-accent">More {story.category}</p>
          <ul className="mt-4 m-0 list-none divide-y divide-ws-border border-y border-ws-border p-0">
            {related.map(item => (
              <li key={item.id}>
                <Link href={`/positive-ai/stories/${item.id}`} className="grid gap-2 py-4 no-underline transition-colors hover:bg-ws-elevated/80 sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <span className="type-meta text-ws-muted">{formatDate(item.published_at)}</span>
                  <span className="font-[family-name:var(--font-display)] text-[1.3rem] font-medium leading-tight text-ws-black hover:text-ws-accent">
                    {item.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <dt className="type-meta text-ws-muted">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">{value}</dd>
    </div>
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
