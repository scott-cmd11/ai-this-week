'use client'

import { useState, useEffect } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import { titleQualityWarnings } from '@/lib/title-quality'

interface DailyArticle {
  title: string | null
  annotation: string | null
  url: string | null
  imageUrl: string | null
  annotationBlockId: string | null
  category: string | null
}

interface DraftDuplicateWarning {
  index: number
  title: string
  message: string
}

export function TodaysDraft({
  password,
  showPublishAction = true,
  onDraftStatusChange,
}: {
  password: string
  showPublishAction?: boolean
  onDraftStatusChange?: (status: { hasDraft: boolean; articleCount: number }) => void
}) {
  const [draft, setDraft] = useState<{ id: string; issueNumber: number; issueDate: string; title: string } | null>(null)
  const [articles, setArticles] = useState<DailyArticle[]>([])
  const [duplicateWarnings, setDuplicateWarnings] = useState<DraftDuplicateWarning[]>([])
  const [draftLoading, setDraftLoading] = useState(true)
  const [draftError, setDraftError] = useState<string | null>(null)

  const [publishing, setPublishing] = useState(false)
  const [publishMessage, setPublishMessage] = useState<string | null>(null)

  async function loadDraft() {
    setDraftLoading(true)
    setDraftError(null)
    try {
      const res = await fetch('/api/today-draft', {
        headers: { 'x-admin-password': password },
      })
      if (!res.ok) { setDraftError('Could not load today\'s draft.'); return }
      const data = await res.json()
      setDraft(data.draft ?? null)
      setArticles(data.articles ?? [])
      setDuplicateWarnings(Array.isArray(data.duplicateWarnings) ? data.duplicateWarnings : [])
      onDraftStatusChange?.({
        hasDraft: !!data.draft,
        articleCount: Array.isArray(data.articles) ? data.articles.length : 0,
      })
    } catch {
      setDraftError('Network error.')
    } finally {
      setDraftLoading(false)
    }
  }

  useEffect(() => {
    loadDraft()
    const handler = () => loadDraft()
    window.addEventListener('aitoday:refresh-draft', handler)
    return () => window.removeEventListener('aitoday:refresh-draft', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePublishNow() {
    if (!draft) return
    setPublishing(true)
    setPublishMessage(null)
    try {
      const res = await fetch('/api/publish-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pageId: draft.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPublishMessage(`Error: ${data.error ?? res.status}`)
        return
      }
      setPublishMessage(`✓ Issue #${draft.issueNumber} published — live on the public site.`)
      await loadDraft()
    } catch {
      setPublishMessage('Network error. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  function renderGroupedArticles() {
    const titleWarnings = articles.flatMap((article, index) =>
      titleQualityWarnings(article.title).map(warning => ({
        index: index + 1,
        title: article.title ?? '(untitled)',
        message: warning.message,
      }))
    )
    const grouped = new Map<string, Array<{ n: number; a: DailyArticle }>>()
    articles.forEach((a, i) => {
      const cat = a.category ?? 'Uncategorized'
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push({ n: i + 1, a })
    })
    const orderedCats = [
      ...CATEGORY_ORDER.filter(c => grouped.has(c)),
      ...[...grouped.keys()].filter(c => !CATEGORY_ORDER.includes(c as Category)),
    ]
    return (
      <div className="flex flex-col gap-5">
        {titleWarnings.length > 0 && (
          <div className="border-[3px] border-ws-accent bg-ws-accent-light/40 px-4 py-3">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-ws-accent mb-2">
              Review title warnings before publishing
            </p>
            <ul className="list-disc pl-5 text-[13px] text-ws-black/75 flex flex-col gap-1">
              {titleWarnings.map(warning => (
                <li key={`${warning.index}-${warning.title}`}>
                  #{warning.index}: <strong>{warning.title}</strong> - {warning.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {duplicateWarnings.length > 0 && (
          <div className="border-[3px] border-ws-accent bg-ws-accent-light/40 px-4 py-3">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-ws-accent mb-2">
              Review possible repeats before publishing
            </p>
            <ul className="list-disc pl-5 text-[13px] text-ws-black/75 flex flex-col gap-1">
              {duplicateWarnings.map(warning => (
                <li key={`${warning.index}-${warning.title}`}>
                  #{warning.index}: <strong>{warning.title}</strong> - {warning.message}
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ws-black/60 mt-2">
              Remove anything you do not want from the live issue desk before publishing.
            </p>
          </div>
        )}
        {orderedCats.map(cat => {
          const items = grouped.get(cat)!
          const meta = CATEGORY_META[cat as Category]
          return (
            <section key={cat}>
              <p className="text-[12px] font-black uppercase tracking-[0.12em] mb-2 pb-1 border-b-[2px] border-ws-black">
                {meta?.icon ? `${meta.icon} ` : ''}{cat}
                <span className="ml-2 text-ws-black/40 font-normal normal-case tracking-normal text-[11px]">({items.length})</span>
              </p>
              <ul className="flex flex-col divide-y divide-ws-black/10">
                {items.map(({ n, a }) => {
                  let hostname: string | null = null
                  if (a.url) {
                    try { hostname = new URL(a.url).hostname.replace(/^www\./, '') } catch {}
                  }
                  return (
                    <li key={n} className="py-3 flex flex-col gap-2">
                      <div className="flex gap-3 items-start">
                        <span className="shrink-0 w-7 h-7 border-[2px] border-ws-black flex items-center justify-center text-[12px] font-black tabular-nums">
                          {n}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-snug">{a.title ?? '(untitled)'}</p>
                          {a.annotation && (
                            <p className="text-[13px] text-ws-black/70 line-clamp-1 mt-0.5">{a.annotation}</p>
                          )}
                          {hostname && (
                            <a
                              href={a.url ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] text-ws-black/50 underline hover:no-underline mt-0.5 inline-block"
                            >
                              {hostname} ↗
                            </a>
                          )}
                        </div>
                      </div>

                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Today&apos;s draft</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">
            {showPublishAction
              ? 'Review the final issue. When it looks right, publish.'
              : 'Review the assembled issue. Publishing happens in the next step.'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadDraft}
          disabled={draftLoading}
          className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent disabled:opacity-50"
        >
          {draftLoading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {draftError && <p className="text-[14px] font-bold text-ws-accent">{draftError}</p>}

      {!draftLoading && draft && (
        <p className="text-[13px] text-ws-black/70">
          <strong className="text-ws-black">{articles.length} article{articles.length !== 1 ? 's' : ''}</strong>
          {' · '}Issue #{draft.issueNumber}
          {' · '}{draft.issueDate}
        </p>
      )}
      {!draftLoading && !draft && (
        <p className="text-[14px] text-ws-black/70">Nothing here yet. Import articles, papers, or events from the panels above — or use <strong>Add an article manually</strong> below.</p>
      )}

      {publishMessage && (
        <p className="text-[14px] font-bold text-ws-black">{publishMessage}</p>
      )}

      {articles.length > 0 && renderGroupedArticles()}

      {draft && articles.length > 0 && showPublishAction && (
        <div className="border-t-[2px] border-ws-black/20 pt-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12px] text-ws-black/60">
            Once you click <strong>Publish now</strong>, this issue is live on the public site immediately.
          </p>
          <button
            type="button"
            onClick={handlePublishNow}
            disabled={publishing}
            className="border-[3px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[15px] px-6 py-3 shadow-[4px_4px_0_0_var(--color-ws-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {publishing ? 'Publishing…' : 'Publish now ↗'}
          </button>
        </div>
      )}

      {draft && articles.length > 0 && !showPublishAction && (
        <div className="border-t-[2px] border-ws-black/20 pt-5">
          <p className="text-[12px] text-ws-black/60">
            Review and add anything missing here. Publishing happens in the next step.
          </p>
        </div>
      )}
    </div>
  )
}
