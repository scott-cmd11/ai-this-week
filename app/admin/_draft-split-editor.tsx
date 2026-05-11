'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATEGORY_META, CATEGORY_ORDER, type Category } from '@/lib/category-mapping'
import type { DailyArticle } from '@/lib/draft-articles'
import { AddArticleManually } from './_add-article-manually'
import { AddEvent } from './_add-event'

type MobileTab = 'edit' | 'preview'

interface TodayDraftPayload {
  draft: {
    id: string
    issueNumber: number
    issueDate: string
    title: string
  } | null
  articles: DailyArticle[]
  articleCount: number
}

function categoryMeta(category: string) {
  return (CATEGORY_ORDER as readonly string[]).includes(category)
    ? CATEGORY_META[category as Category]
    : null
}

function articleKey(article: DailyArticle, index: number) {
  return `${article.url ?? article.title ?? 'article'}-${index}`
}

function sourceHost(url: string | null) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function DraftSplitEditor({ password }: { password: string }) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('edit')
  const [draft, setDraft] = useState<TodayDraftPayload['draft']>(null)
  const [articles, setArticles] = useState<DailyArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDraft = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/today-draft', {
        headers: { 'x-admin-password': password },
        signal,
      })

      if (res.status === 401) {
        setError('Your admin session has expired. Sign out and sign back in.')
        setDraft(null)
        setArticles([])
        return
      }

      if (!res.ok) {
        setError(`Today draft could not be loaded (${res.status}).`)
        setDraft(null)
        setArticles([])
        return
      }

      const payload = (await res.json()) as TodayDraftPayload
      setDraft(payload.draft)
      setArticles(Array.isArray(payload.articles) ? payload.articles : [])
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Today draft could not be loaded.')
      setDraft(null)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => {
    const controller = new AbortController()
    void loadDraft(controller.signal)
    return () => controller.abort()
  }, [loadDraft])

  useEffect(() => {
    function refreshDraft() {
      void loadDraft()
    }

    window.addEventListener('aitoday:refresh-draft', refreshDraft)
    return () => window.removeEventListener('aitoday:refresh-draft', refreshDraft)
  }, [loadDraft])

  const groupedArticles = useMemo(() => {
    const grouped = new Map<string, DailyArticle[]>()

    for (const article of articles) {
      const category = article.category?.trim() || 'Uncategorized'
      const current = grouped.get(category) ?? []
      current.push(article)
      grouped.set(category, current)
    }

    const orderedKnown = CATEGORY_ORDER
      .filter(category => grouped.has(category))
      .map(category => [category, grouped.get(category) ?? []] as const)
    const unknown = [...grouped.entries()]
      .filter(([category]) => !CATEGORY_ORDER.includes(category as Category))
      .sort(([a], [b]) => a.localeCompare(b))

    return [...orderedKnown, ...unknown]
  }, [articles])

  const hasDraftArticles = Boolean(draft && articles.length > 0)

  return (
    <section className="admin-panel bg-ws-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="admin-eyebrow">Edit</p>
          <h2 className="admin-page-title mt-2">
            Draft editor
          </h2>
          <p className="admin-copy mt-3 max-w-2xl">
            Review the assembled issue, add missing items, and check the reader preview before moving to publish checks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDraft()}
          disabled={loading}
          className="admin-button-secondary self-start px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 border border-ws-border md:hidden" aria-label="Draft editor view">
        <MobileTabButton label="Edit" active={mobileTab === 'edit'} onClick={() => setMobileTab('edit')} />
        <MobileTabButton label="Preview" active={mobileTab === 'preview'} onClick={() => setMobileTab('preview')} />
      </div>

      {error && (
        <p className="mt-5 border-[2px] border-red-700 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-800">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-5 border border-ws-border bg-ws-page px-4 py-3 text-[14px] text-ws-black/65">
          Loading today&apos;s draft.
        </p>
      )}

      {!loading && !draft && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.78fr)]">
          <div className={mobileTab === 'preview' ? 'hidden md:block' : ''}>
            <div className="flex flex-col gap-4">
              <div className="border border-ws-border bg-ws-page px-4 py-3">
                <p className="text-[14px] font-bold text-ws-black">No draft exists yet.</p>
                <p className="mt-1 text-[13px] leading-[1.5] text-ws-black/65">
                  Keep candidates in the Choose step first, or add an article or learning event here to start today&apos;s issue manually.
                </p>
              </div>
              <AddArticleManually password={password} />
              <AddEvent password={password} />
            </div>
          </div>

          <aside className={mobileTab === 'edit' ? 'hidden md:block' : ''}>
            <div className="sticky top-4 rounded-[0.6rem] border border-ws-border bg-ws-page p-4">
              <p className="admin-eyebrow">Reader preview</p>
              <p className="mt-4 text-[13px] leading-[1.5] text-ws-black/65">
                The preview appears after today&apos;s draft has at least one article or event.
              </p>
            </div>
          </aside>
        </div>
      )}

      {draft && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.78fr)]">
          <div className={mobileTab === 'preview' ? 'hidden md:block' : ''}>
            <div className="flex flex-col gap-5">
              <div className="border border-ws-border bg-ws-page px-4 py-3">
                <p className="text-[13px] text-ws-black/70">
                  <strong className="text-ws-black">{articles.length} article{articles.length === 1 ? '' : 's'}</strong>
                  {' / '}Issue #{draft.issueNumber}
                  {' / '}{draft.issueDate}
                </p>
              </div>

              {!hasDraftArticles && (
                <div className="border border-ws-border bg-ws-page px-4 py-3">
                  <p className="text-[14px] font-bold text-ws-black">This draft is empty.</p>
                  <p className="mt-1 text-[13px] leading-[1.5] text-ws-black/65">
                    Add an article or learning event below to start shaping today&apos;s issue.
                  </p>
                </div>
              )}

              {groupedArticles.map(([category, items]) => (
                <EditorCategorySection key={category} category={category} articles={items} />
              ))}

              <div className="flex flex-col gap-4 border-t border-ws-border pt-5">
                <AddArticleManually
                  password={password}
                  targetIssueId={draft.id}
                  targetIssueLabel={`Issue #${draft.issueNumber}`}
                />
                <AddEvent
                  password={password}
                  targetIssueId={draft.id}
                  targetIssueLabel={`Issue #${draft.issueNumber}`}
                />
              </div>
            </div>
          </div>

          <aside className={mobileTab === 'edit' ? 'hidden md:block' : ''}>
            <PreviewColumn draft={draft} groupedArticles={groupedArticles} />
          </aside>
        </div>
      )}
    </section>
  )
}

function MobileTabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-[12px] font-black uppercase tracking-[0.08em] ${
        active ? 'bg-ws-black text-ws-white' : 'bg-ws-white text-ws-black hover:bg-ws-page'
      }`}
    >
      {label}
    </button>
  )
}

function EditorCategorySection({
  category,
  articles,
}: {
  category: string
  articles: DailyArticle[]
}) {
  const meta = categoryMeta(category)

  return (
    <section className="overflow-hidden rounded-[0.6rem] border border-ws-border">
      <div className="flex flex-col gap-1 bg-ws-page px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-[0.1em]">
            {meta?.icon ? `${meta.icon} ` : ''}{category}
          </h3>
          {meta?.tagline && (
            <p className="mt-0.5 text-[12px] leading-snug text-ws-black/55">{meta.tagline}</p>
          )}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ws-black/45">
          {articles.length} item{articles.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="divide-y divide-ws-black/10">
        {articles.map((article, index) => {
          const host = sourceHost(article.url)

          return (
            <article key={articleKey(article, index)} className="px-4 py-3">
              <h4 className="text-[15px] font-black leading-snug text-ws-black">
                {article.title || '(untitled)'}
              </h4>
              <p className="mt-1 text-[13px] leading-[1.5] text-ws-black/70">
                {article.annotation || '(missing summary)'}
              </p>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-[12px] font-bold text-ws-black/55 underline hover:text-ws-accent"
                >
                  Open source{host ? `: ${host}` : ''}
                </a>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PreviewColumn({
  draft,
  groupedArticles,
}: {
  draft: NonNullable<TodayDraftPayload['draft']>
  groupedArticles: Array<readonly [string, DailyArticle[]]>
}) {
  return (
    <div className="sticky top-4 rounded-[0.6rem] border border-ws-border bg-ws-page p-4">
      <p className="admin-eyebrow">Reader preview</p>
      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-bold leading-none tracking-normal">
        AI Today
      </h3>
      <p className="mt-2 text-[13px] font-bold text-ws-black/65">
        Issue #{draft.issueNumber} / {draft.issueDate}
      </p>

      {groupedArticles.length === 0 ? (
        <p className="mt-5 text-[13px] leading-[1.5] text-ws-black/65">
          Add articles to see the public-style grouped preview.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {groupedArticles.map(([category, items]) => {
            const meta = categoryMeta(category)

            return (
              <section key={`${category}-preview`}>
                <h4 className="border-b border-ws-border pb-1 text-[13px] font-black uppercase tracking-[0.1em]">
                  {meta?.icon ? `${meta.icon} ` : ''}{category}
                </h4>
                <div className="mt-3 flex flex-col gap-3">
                  {items.map((article, index) => (
                    <article key={`${articleKey(article, index)}-preview`}>
                      <h5 className="text-[15px] font-bold leading-snug text-ws-black">
                        {article.title || '(untitled)'}
                      </h5>
                      <p className="mt-1 text-[13px] leading-[1.5] text-ws-black/68">
                        {article.annotation || '(missing summary)'}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
