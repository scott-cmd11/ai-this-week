import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { GOOD_NEWS_CATEGORIES } from '@/lib/good-news-types'
import { coerceGoodNewsCategory } from '@/lib/good-news-scoring'
import { listCurrentPublishedGoodNewsStories } from '@/lib/good-news-current'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI Good News Archive',
  description: 'Browse positive, evidence-based AI stories by date, category, source, and tags.',
  alternates: {
    canonical: '/positive-ai/archive',
  },
}

interface Props {
  searchParams?: Promise<{ category?: string; source?: string; tag?: string; q?: string }>
}

export default async function GoodNewsArchivePage({ searchParams }: Props) {
  const params = await searchParams
  const category = coerceGoodNewsCategory(params?.category)
  const now = new Date()
  const stories = await listCurrentPublishedGoodNewsStories({
    category,
    query: params?.q || params?.source || params?.tag || null,
    now,
    limit: 200,
  })
  const sources = Array.from(new Set(stories.map(story => story.source_name))).sort()
  const tags = Array.from(new Set(stories.flatMap(story => story.tags))).sort().slice(0, 30)

  return (
    <>
      <p className="type-kicker mb-5">AI Good News archive</p>
      <section className="border-t border-ws-black pt-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <h1 className="type-page-title mb-4">Browse the useful AI progress file</h1>
            <p className="type-lede max-w-3xl">
              Filter the last 24 hours by category, source, and tags. Every published story keeps its original source link and evidence note.
            </p>
          </div>
          <aside className="border-y border-ws-border py-4">
            <p className="type-meta text-ws-accent">Last-24h count</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
              {stories.length}
            </p>
          </aside>
        </div>
      </section>

      <ArchiveFilters selectedCategory={category} sources={sources} tags={tags} />

      <ul className="mt-10 m-0 list-none divide-y divide-ws-border border-y border-ws-border p-0">
        {stories.map(story => (
          <li key={story.id}>
            <Link
              href={`/positive-ai/stories/${story.id}`}
              className="grid gap-2 py-5 no-underline transition-colors hover:bg-ws-elevated/80 sm:grid-cols-[8rem_9rem_minmax(0,1fr)_6rem] sm:items-baseline"
            >
              <span className="type-meta text-ws-muted">{formatDate(story.published_at)}</span>
              <span className="type-meta text-ws-accent">{story.category}</span>
              <span>
                <span className="block font-[family-name:var(--font-display)] text-[1.45rem] font-medium leading-tight text-ws-black">
                  {story.title}
                </span>
                <span className="mt-1 block text-[14px] leading-[1.45] text-ws-muted">
                  {story.source_name}
                </span>
              </span>
              <span className="type-meta text-ws-muted sm:text-right">{story.credibility_score}/100</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function ArchiveFilters({
  selectedCategory,
  sources,
  tags,
}: {
  selectedCategory: string | null
  sources: string[]
  tags: string[]
}) {
  return (
    <section aria-label="Archive filters" className="mt-10 border-y border-ws-border py-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <FilterGroup label="Categories">
          <Link href="/positive-ai/archive" className={filterClass(!selectedCategory)}>All</Link>
          {GOOD_NEWS_CATEGORIES.map(category => (
            <Link key={category} href={`/positive-ai/archive?category=${encodeURIComponent(category)}`} className={filterClass(selectedCategory === category)}>
              {category}
            </Link>
          ))}
        </FilterGroup>
        <FilterGroup label="Sources">
          {sources.slice(0, 10).map(source => (
            <Link key={source} href={`/positive-ai/archive?source=${encodeURIComponent(source)}`} className={filterClass(false)}>
              {source}
            </Link>
          ))}
        </FilterGroup>
        <FilterGroup label="Tags">
          {tags.slice(0, 12).map(tag => (
            <Link key={tag} href={`/positive-ai/archive?tag=${encodeURIComponent(tag)}`} className={filterClass(false)}>
              {tag}
            </Link>
          ))}
        </FilterGroup>
      </div>
    </section>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="type-meta mb-3 text-ws-accent">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function filterClass(active: boolean): string {
  return [
    'type-meta good-news-filter-chip inline-flex border px-2.5 py-1.5 no-underline transition-colors',
    active
      ? 'good-news-filter-active border-ws-accent bg-ws-accent'
      : 'border-ws-border bg-ws-elevated text-ws-muted hover:border-ws-accent hover:bg-ws-accent-light hover:text-ws-accent',
  ].join(' ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
