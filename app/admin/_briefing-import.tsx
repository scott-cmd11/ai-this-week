'use client'

import { useState, useEffect, useRef } from 'react'
import { categorize, categoryForArticle, CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'
import { findSimilarTitle as findSimilarTitleMatch } from '@/lib/title-dedupe'
import { useKnownUrls } from './_use-known-urls'

interface BriefingArticle {
  title: string
  summary: string
  urls: string[]
  rawText: string
}

interface BriefingSection {
  name: string
  articles: BriefingArticle[]
}

interface BriefingSourceData {
  sourceLabel: string
  sourceId: string
  briefingPageId: string | null
  briefingTitle: string | null
  briefing: { flaggedTopics: string[]; sections: BriefingSection[] } | null
  error?: string
}

interface BriefingApiResponse {
  date: string
  configured: boolean
  sources: BriefingSourceData[]
}

interface ImportWarning {
  url: string
  title: string
  message: string
}

async function loadDraftArticleCount(password: string): Promise<number> {
  const res = await fetch('/api/today-draft', {
    headers: { 'x-admin-password': password },
  })
  if (!res.ok) return 0
  const payload = await res.json()
  return typeof payload.articleCount === 'number' ? payload.articleCount : 0
}

function articleKey(sourceId: string, sectionName: string, article: BriefingArticle, index: number): string {
  return `${sourceId}::${sectionName}::${index}::${article.title}::${article.urls[0] ?? ''}`
}

export function BriefingImport({ password }: { password: string }) {
  const [data, setData] = useState<BriefingApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<ImportWarning[]>([])
  const [rewriteWithAi, setRewriteWithAi] = useState(true)
  const [overrides, setOverrides] = useState<Map<string, Category>>(new Map())
  const [draftArticleCount, setDraftArticleCount] = useState(0)
  const userUncheckedRef = useRef<Set<string>>(new Set())
  const isFirstLoadRef = useRef(true)
  const { isKnown, findSimilarTitle, windowDays, loaded: knownLoaded } = useKnownUrls(password)

  function setOverride(key: string, category: Category) {
    setOverrides(prev => {
      const next = new Map(prev)
      next.set(key, category)
      return next
    })
  }

  async function load() {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/briefing-sources', {
        headers: { 'x-admin-password': password },
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const payload = (await res.json()) as BriefingApiResponse
      const currentDraftArticleCount = await loadDraftArticleCount(password)
      setDraftArticleCount(currentDraftArticleCount)
      setData(payload)
      const initial = new Set<string>()
      if (currentDraftArticleCount === 0) {
        const selectedTitles: Array<{ title: string }> = []
        for (const source of payload.sources) {
          if (!source.briefing) continue
          for (const section of source.briefing.sections) {
            for (let index = 0; index < section.articles.length; index++) {
              const a = section.articles[index]
              if (a.urls[0] && isKnown(a.urls[0])) continue
              if (findSimilarTitle(a.title)) continue
              if (findSimilarTitleMatch(a.title, selectedTitles)) continue
              initial.add(articleKey(source.sourceId, section.name, a, index))
              selectedTitles.push({ title: a.title })
            }
          }
        }
      }
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false
        setSelected(initial)
      } else {
        setSelected(new Set([...initial].filter(k => !userUncheckedRef.current.has(k))))
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!knownLoaded) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownLoaded])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        userUncheckedRef.current.add(key)
      } else {
        next.add(key)
        userUncheckedRef.current.delete(key)
      }
      return next
    })
  }

  function toggleAllInCategory(entries: { key: string }[], on: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      for (const e of entries) {
        if (on) next.add(e.key); else next.delete(e.key)
      }
      return next
    })
  }

  async function handleImport() {
    if (!data || selected.size === 0) return
    setImporting(true)
    setMessage(null)
    setWarnings([])
    setError(null)

    const toImport: { title: string; summary: string; url: string; category: Category }[] = []
    for (const source of data.sources) {
      if (!source.briefing) continue
        for (const section of source.briefing.sections) {
        const sectionCategory = categorize(source.sourceLabel, section.name)
        for (let index = 0; index < section.articles.length; index++) {
          const a = section.articles[index]
          const k = articleKey(source.sourceId, section.name, a, index)
          if (selected.has(k) && a.urls[0]) {
            const autoCat = categoryForArticle({
              title: a.title,
              summary: a.summary,
              url: a.urls[0],
              sourceLabel: source.sourceLabel,
              category: sectionCategory,
            }, sectionCategory)
            const cat = overrides.get(k) ?? autoCat
            toImport.push({ title: a.title, summary: a.summary, url: a.urls[0], category: cat })
          }
        }
      }
    }

    if (toImport.length === 0) {
      setError('No selected articles had a usable URL.')
      setImporting(false)
      return
    }

    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, articles: toImport, rewriteWithAi }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      const failed = (payload.results ?? []).filter((r: { ok: boolean }) => !r.ok).length
      const importWarnings: ImportWarning[] = (payload.results ?? []).flatMap((r: {
        url: string
        title: string
        warnings?: Array<{ message: string }>
      }) => (r.warnings ?? []).map(w => ({ url: r.url, title: r.title, message: w.message })))
      setWarnings(importWarnings)
      setMessage(
        failed > 0
          ? `✓ Imported ${payload.added} of ${payload.attempted} (${failed} failed). Today's draft now has ${payload.articleCount} article${payload.articleCount === 1 ? '' : 's'}.`
          : `✓ Imported ${payload.added} article${payload.added === 1 ? '' : 's'}. Today's draft now has ${payload.articleCount}.`,
      )
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
      setSelected(new Set())
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  if (data && data.configured === false) return null

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">
            Import from briefings
            {data?.date && <span className="ml-2 text-ws-black/50">({data.date})</span>}
          </p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Today&apos;s articles from each connected source, pre-checked. Uncheck anything you don&apos;t want, then click Import.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent disabled:opacity-50 shrink-0"
        >
          {loading ? '↻ Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}
      {data && draftArticleCount > 0 && selected.size === 0 && (
        <p className="border-[2px] border-ws-black/20 bg-ws-page px-4 py-3 text-[13px] text-ws-black/70">
          Today&apos;s draft already has {draftArticleCount} article{draftArticleCount === 1 ? '' : 's'}, so remaining briefing items are left unchecked. Check only the extra articles you want to add.
        </p>
      )}
      {warnings.length > 0 && (
        <div className="border-[2px] border-ws-accent bg-ws-accent/10 px-4 py-3 text-[13px]">
          <p className="font-black uppercase tracking-wide text-ws-accent mb-2">Review title changes</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {warnings.map((warning, index) => (
              <li key={`${warning.url}-${index}`}>
                <strong>{warning.title}</strong> - {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && !data && <p className="text-[14px] text-ws-black/70">Loading briefings…</p>}

      {/* Duplicate banner */}
      {data && (() => {
        let dupeCount = 0
        for (const source of data.sources) {
          if (!source.briefing) continue
          for (const section of source.briefing.sections) {
            for (const a of section.articles) {
              if ((a.urls[0] && isKnown(a.urls[0])) || findSimilarTitle(a.title)) dupeCount++
            }
          }
        }
        if (dupeCount === 0) return null
        return (
          <p className="border-[2px] border-ws-accent bg-ws-accent/10 px-4 py-3 text-[13px] font-bold">
            ⚠ <strong>{dupeCount} article{dupeCount === 1 ? '' : 's'}</strong> already covered in the last {windowDays} days — pre-unchecked. Re-check any you want to include anyway.
          </p>
        )
      })()}

      {/* Flagged-topic callouts */}
      {data?.sources.some(s => s.briefing && s.briefing.flaggedTopics.length > 0) && (
        <div className="border-l-[3px] border-ws-accent pl-3 py-1">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-ws-accent/80 mb-1">
            🚩 Flagged today
          </p>
          <ul className="text-[13px] text-ws-black/80 list-none p-0 m-0 flex flex-col gap-0.5">
            {data.sources.flatMap(s =>
              s.briefing
                ? s.briefing.flaggedTopics.map((t, i) => (
                    <li key={`${s.sourceId}-${i}`}>
                      • {t} <span className="text-ws-black/40">· {s.sourceLabel}</span>
                    </li>
                  ))
                : []
            )}
          </ul>
        </div>
      )}

      {/* Source-level chrome */}
      {data && data.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.sources.map(source => {
            const articleCount = source.briefing
              ? source.briefing.sections.reduce((n, s) => n + s.articles.length, 0)
              : 0
            return (
              <div
                key={source.sourceId}
                className="flex items-center justify-between gap-3 flex-wrap border border-ws-black/15 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {source.sourceLabel}
                    {source.briefing && (
                      <span className="ml-2 text-[12px] font-normal text-ws-black/50">
                        {articleCount} article{articleCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                  {source.error && (
                    <p className="text-[12px] font-bold text-ws-accent mt-1">
                      ⚠ Can&apos;t access in Notion — share the page with the &quot;AI This Week Site&quot; integration.
                    </p>
                  )}
                  {!source.briefing && !source.error && (
                    <p className="text-[12px] text-ws-black/60 mt-1">No briefing for {data.date} yet.</p>
                  )}
                </div>
                {source.briefingPageId && (
                  <a
                    href={`https://notion.so/${source.briefingPageId.replace(/-/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-ws-accent underline hover:no-underline font-medium shrink-0"
                  >
                    Open in Notion ↗
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Categorized article view */}
      {data && (() => {
        type Entry = {
          key: string
          autoCategory: Category
          category: Category
          article: BriefingArticle
          sourceLabel: string
          sectionName: string
        }
        const entries: Entry[] = []
        for (const source of data.sources) {
          if (!source.briefing) continue
          for (const section of source.briefing.sections) {
            const sectionCategory = categorize(source.sourceLabel, section.name)
            for (let index = 0; index < section.articles.length; index++) {
              const a = section.articles[index]
              const k = articleKey(source.sourceId, section.name, a, index)
              const autoCat = categoryForArticle({
                title: a.title,
                summary: a.summary,
                url: a.urls[0],
                sourceLabel: source.sourceLabel,
                category: sectionCategory,
              }, sectionCategory)
              const effective = overrides.get(k) ?? autoCat
              entries.push({
                key: k,
                autoCategory: autoCat,
                category: effective,
                article: a,
                sourceLabel: source.sourceLabel,
                sectionName: section.name,
              })
            }
          }
        }
        if (entries.length === 0) return null
        const firstSimilarByKey = new Map<string, Entry>()
        const previousEntries: Entry[] = []
        for (const entry of entries) {
          const similar = findSimilarTitleMatch(entry.article.title, previousEntries.map(e => ({ ...e, title: e.article.title })))
          if (similar) firstSimilarByKey.set(entry.key, similar)
          previousEntries.push(entry)
        }

        const byCategory = new Map<Category, Entry[]>()
        for (const cat of CATEGORY_ORDER) byCategory.set(cat, [])
        for (const e of entries) byCategory.get(e.category)!.push(e)

        return (
          <div className="flex flex-col gap-5 mt-2">
            {CATEGORY_ORDER.map(cat => {
              const bucket = byCategory.get(cat)!
              if (bucket.length === 0) return null
              const allChecked = bucket.every(e => selected.has(e.key))
              const meta = CATEGORY_META[cat]
              return (
                <div key={cat} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap border-b-[2px] border-ws-black pb-1">
                    <div className="min-w-0">
                      <p className="text-[14px] font-black uppercase tracking-[0.08em]">
                        <span className="mr-1.5" aria-hidden="true">{meta.icon}</span>
                        {cat}
                        <span className="ml-2 text-[12px] font-normal normal-case tracking-normal text-ws-black/50">
                          {bucket.length} article{bucket.length !== 1 ? 's' : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-ws-black/50 mt-0.5">{meta.tagline}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAllInCategory(bucket, !allChecked)}
                      className="text-[11px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent shrink-0"
                    >
                      {allChecked ? 'Uncheck all' : 'Check all'}
                    </button>
                  </div>
                  <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
                    {bucket.map(e => {
                      const checked = selected.has(e.key)
                      const similarTitle = findSimilarTitle(e.article.title)
                      const similarImportTitle = firstSimilarByKey.get(e.key)
                      const dupe = isKnown(e.article.urls[0]) || Boolean(similarTitle) || Boolean(similarImportTitle)
                      const hostname = e.article.urls[0]
                        ? new URL(e.article.urls[0]).hostname.replace(/^www\./, '')
                        : ''
                      return (
                        <li
                          key={e.key}
                          className="flex gap-3 items-start border border-ws-black/10 px-2 py-2 bg-ws-page/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(e.key)}
                            className="mt-1 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
                            aria-label={`Include ${e.article.title}`}
                          />
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <p className="text-[14px] font-bold leading-tight">
                              {e.article.title}
                              {dupe && (
                                <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-ws-accent border border-ws-accent px-1.5 py-0.5 align-middle whitespace-nowrap">
                                  Already covered
                                </span>
                              )}
                            </p>
                            {similarTitle && (
                              <p className="text-[11px] font-semibold text-ws-accent">
                                Similar to Issue {similarTitle.issueNumber} ({similarTitle.issueDate}): {similarTitle.title}
                              </p>
                            )}
                            {similarImportTitle && (
                              <p className="text-[11px] font-semibold text-ws-accent">
                                Similar to another briefing item today: {similarImportTitle.article.title}
                              </p>
                            )}
                            {e.article.summary && (
                              <p className="text-[12px] text-ws-black/70 line-clamp-2 leading-snug">
                                {e.article.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-ws-black/50">
                              {hostname && (
                                <a
                                  href={e.article.urls[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:no-underline truncate"
                                >
                                  {hostname}
                                </a>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="truncate">
                                {e.sourceLabel} / {e.sectionName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <label className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-wide text-ws-black/40">Category:</span>
                                <select
                                  value={e.category}
                                  onChange={ev => setOverride(e.key, ev.target.value as Category)}
                                  className={`text-[11px] font-bold bg-transparent border ${
                                    overrides.has(e.key)
                                      ? 'border-ws-accent text-ws-accent'
                                      : 'border-ws-black/20 text-ws-black/70 hover:border-ws-black/50'
                                  } rounded-none px-1 py-0.5 cursor-pointer focus:outline-none focus:border-ws-accent`}
                                  aria-label={`Category for ${e.article.title}`}
                                >
                                  {CATEGORY_ORDER.map(c => (
                                    <option key={c} value={c}>
                                      {CATEGORY_META[c].icon} {c}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )
      })()}

      {data && data.sources.some(s => s.briefing) && (
        <div className="pt-3 border-t-[2px] border-ws-black/10 flex flex-col gap-3">
          {/* AI rewrite toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rewriteWithAi}
              onChange={e => setRewriteWithAi(e.target.checked)}
              disabled={importing}
              className="mt-0.5 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold leading-tight">
                Rewrite summaries in the AI Today voice <span className="text-ws-accent text-[11px] font-black uppercase tracking-wide ml-1">Recommended</span>
              </span>
              <span className="text-[12px] text-ws-black/60 leading-snug">
                Each briefing source has its own writing style. With this on, GPT rewrites every summary
                in plain language using the AI Today voice — so the published issue reads as one
                consistent voice instead of a patchwork. Adds ~2–3 sec per article.
                The import also tries to pull each publisher&apos;s article image when one is available.
                Turn off only if you&apos;re in a rush and the source text is already clean.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-ws-black/70">{selected.size} selected</p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[13px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing
                ? rewriteWithAi
                  ? `…Importing ${selected.size} (AI rewriting)`
                  : '…Importing'
                : `+ Import ${selected.size} into today's draft`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
