import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  GOOD_NEWS_CATEGORIES,
  type GoodNewsCategory,
  type GoodNewsStory,
} from '@/lib/good-news-types'
import { getLatestGoodNewsDigest } from '@/lib/good-news-store'
import { coerceGoodNewsCategory } from '@/lib/good-news-scoring'
import { generateDailyDigest } from '@/lib/good-news-digest'
import { GOOD_NEWS_CURRENT_WINDOW_HOURS, isGoodNewsStoryCurrent, goodNewsDateId } from '@/lib/good-news-recency'
import { listCurrentPublishedGoodNewsStories } from '@/lib/good-news-current'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'AI Good News',
  description:
    'Daily positive, evidence-based AI stories about health, education, accessibility, science, climate, work, creativity, safety, public good, and small business.',
  alternates: {
    canonical: '/positive-ai',
  },
}

interface Props {
  searchParams?: Promise<{ category?: string }>
}

export default async function PositiveAiPage({ searchParams }: Props) {
  const params = await searchParams
  const selectedCategory = coerceGoodNewsCategory(params?.category)
  const now = new Date()
  const [stories, storedDigest] = await Promise.all([
    listCurrentPublishedGoodNewsStories({
      category: selectedCategory,
      now,
      limit: 60,
    }),
    getLatestGoodNewsDigest(),
  ])
  const currentStoryIds = new Set(stories.map(story => story.id))
  const minimumDigestStories = Math.min(5, stories.length)
  const digest = storedDigest.date === goodNewsDateId(now)
    && storedDigest.story_ids.length > 0
    && storedDigest.story_ids.length >= minimumDigestStories
    && storedDigest.story_ids.every(id => currentStoryIds.has(id))
    ? storedDigest
    : generateDailyDigest(stories, now)
  const digestStories = digest.story_ids
    .map(id => stories.find(story => story.id === id))
    .filter((story): story is GoodNewsStory => Boolean(story))
  const visibleStories = stories.slice(0, 12)
  const hasStrictWindowStories = stories.some(story => isGoodNewsStoryCurrent(story, now, GOOD_NEWS_CURRENT_WINDOW_HOURS))
  const storyWindowLabel = hasStrictWindowStories ? 'Last-24h stories' : 'Last-48h fallback'

  return (
    <>
      <section className="good-news-hero" aria-labelledby="positive-ai-title">
        <Image
          src="/images/ai-good-news/meadow-human-progress.png"
          alt="People using AI-supported tools for learning, research, plant care, and small business work in a warm green setting."
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1240px"
          className="good-news-hero-image"
        />
        <div className="good-news-hero-content">
          <div className="good-news-hero-copy">
            <p className="type-kicker good-news-hero-kicker mb-5">AI Good News</p>
            <h1 id="positive-ai-title" className="good-news-hero-title">
              Daily AI good news for people who want proof, not hype.
            </h1>
            <p className="good-news-hero-lede">
              A source-linked briefing on AI helping people in health, education, accessibility,
              science, climate, safety, public service, creativity, and small business.
            </p>
          </div>

          <dl className="good-news-hero-file" aria-label="AI Good News file">
            <HeroMetric label={storyWindowLabel} value={String(stories.length)} />
            <HeroMetric label="Digest date" value={digest.date} />
            <HeroMetric label="Standard" value="Positive, verifiable, source-linked." />
          </dl>
        </div>
      </section>

      <CategoryFilter selectedCategory={selectedCategory} />

      <section aria-labelledby="digest-title" className="mt-10 border-y border-ws-border py-6">
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="type-meta text-ws-accent">Today&apos;s AI Good News Digest</p>
            <h2 id="digest-title" className="mt-3 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
              {digest.headline}
            </h2>
            <p className="mt-3 text-[15px] leading-[1.55] text-ws-muted">{digest.intro}</p>
          </div>

          {digestStories.length > 0 ? (
            <ol className="m-0 grid list-none gap-3 p-0">
              {digestStories.map((story, index) => (
                <li key={story.id} className="grid gap-2 border-t border-ws-border pt-3 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                  <span className="font-[family-name:var(--font-display)] text-[1.6rem] font-medium leading-none text-ws-accent/75">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Link href={`/positive-ai/stories/${story.id}`} className="font-semibold leading-snug text-ws-black no-underline hover:text-ws-accent">
                    {story.title}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[15px] leading-[1.55] text-ws-muted">
              No high-confidence positive AI stories from the last 48 hours are ready yet.
            </p>
          )}
        </div>
      </section>

      <div className="section-rule my-10" aria-hidden="true" />

      {visibleStories.length === 0 ? (
        <div className="border-y border-ws-border py-6">
          <p className="type-card-title">No high-confidence positive AI stories from the last 48 hours match this filter yet.</p>
          <p className="type-body mt-2 max-w-2xl">
            The desk is holding the line: fewer stories are better than weak, mixed, or fear-framed AI coverage.
          </p>
        </div>
      ) : (
        <section aria-label="Top positive AI stories">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-meta text-ws-accent">Top stories</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[2.35rem] font-semibold leading-none text-ws-black">
                {selectedCategory ? `${selectedCategory} stories` : "Today's positive AI stories"}
              </h2>
            </div>
            <Link href="/positive-ai/archive" className="type-meta text-ws-accent hover:text-ws-accent-hover">
              Browse archive
            </Link>
          </div>
          <ol className="m-0 list-none divide-y divide-ws-border border-y border-ws-border p-0">
            {visibleStories.map((story, index) => (
              <li key={story.id}>
                <StoryCard story={story} index={index + 1} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function CategoryFilter({
  selectedCategory,
}: {
  selectedCategory: GoodNewsCategory | null
}) {
  return (
    <nav aria-label="Filter by category" className="mt-10 border-y border-ws-border py-5">
      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:items-start">
        <p className="type-meta text-ws-accent">Filter</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          <li>
            <Link
              href={goodNewsHref({})}
              className={filterClass(!selectedCategory)}
            >
              All
            </Link>
          </li>
          {GOOD_NEWS_CATEGORIES.map(category => (
            <li key={category}>
              <Link
                href={goodNewsHref({ category })}
                className={filterClass(selectedCategory === category)}
              >
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function goodNewsHref({
  category,
}: {
  category?: GoodNewsCategory
}): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  const query = params.toString()
  return query ? `/positive-ai?${query}` : '/positive-ai'
}

function StoryCard({ story, index }: { story: GoodNewsStory; index: number }) {
  return (
    <article className="grid gap-5 py-6 sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-[4rem_minmax(0,1fr)_14rem]">
      <div className="font-[family-name:var(--font-display)] text-[2.25rem] font-medium leading-none text-ws-accent/70 tabular-nums">
        {String(index).padStart(2, '0')}
      </div>

      <div className="min-w-0">
        <p className="type-meta mb-2 flex flex-wrap items-center gap-2 text-ws-muted">
          <span>{story.source_name}</span>
          <span aria-hidden="true" className="text-ws-border">/</span>
          <time dateTime={story.published_at}>{formatDate(story.published_at)}</time>
          <span aria-hidden="true" className="text-ws-border">/</span>
          <span>{story.category}</span>
        </p>
        <h3 className="max-w-4xl font-[family-name:var(--font-display)] text-[clamp(1.85rem,3.5vw,3.2rem)] font-medium leading-[0.98] text-ws-black">
          <Link href={`/positive-ai/stories/${story.id}`} className="text-ws-black no-underline hover:text-ws-accent">
            {story.title}
          </Link>
        </h3>
        <p className="mt-4 max-w-3xl text-[17px] leading-[1.65] text-ws-muted">{story.summary}</p>
        <div className="mt-4 border-l-2 border-ws-accent pl-4">
          <p className="type-meta text-ws-accent">Why this matters</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-[1.55] text-ws-muted">{story.why_it_matters}</p>
        </div>
      </div>

      <aside className="border-t border-ws-border pt-4 sm:col-start-2 lg:col-start-auto lg:pt-8" aria-label="Credibility signal">
        <p className="type-meta text-ws-accent">Credibility signal</p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-[2rem] font-semibold leading-none text-ws-black">
          {story.credibility_score}
        </p>
        <p className="mt-2 text-[13px] leading-[1.45] text-ws-muted">
          0-100 signal for source quality and evidence. Positivity {story.positivity_score} reflects clear human benefit.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          <Link href={`/positive-ai/stories/${story.id}`} className="type-button inline-flex border-b border-ws-accent pb-1 text-ws-accent no-underline hover:text-ws-accent-hover">
            Evidence check
          </Link>
          <Link href="/positive-ai/about#scoring" className="type-button inline-flex border-b border-ws-border pb-1 text-ws-muted no-underline hover:border-ws-accent hover:text-ws-accent">
            How scoring works
          </Link>
        </div>
      </aside>
    </article>
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
