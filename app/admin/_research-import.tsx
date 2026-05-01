'use client'

import { useState, useEffect, useRef } from 'react'
import { type Category } from '@/lib/category-mapping'
import { useKnownUrls } from './_use-known-urls'

interface ResearchPaperItem {
  id: string
  title: string
  summary: string | null
  keyFindings: string | null
  url: string | null
  hfUrl: string | null
  area: string[]
  authors: string | null
  source: string | null
  arXivId: string | null
  date: string | null
}

interface ResearchApiResponse {
  papers: ResearchPaperItem[]
  date: string
  configured: boolean
  error?: string
}

const NOTION_RESEARCH_DB_URL = 'https://www.notion.so/ce3aae7fc2b743869113af0425febe68'

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function ResearchImport({ password }: { password: string }) {
  const [data, setData] = useState<ResearchApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const { isKnown, windowDays } = useKnownUrls(password)

  function currentDate(): string {
    return dateInputRef.current?.value || todayIso()
  }

  async function load(targetDate = currentDate()) {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/research-papers?date=${encodeURIComponent(targetDate)}`, {
        headers: { 'x-admin-password': password },
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired. Sign in again.' : `Error ${res.status}`)
        return
      }
      const payload = (await res.json()) as ResearchApiResponse
      setData(payload)
      setSelected(new Set(payload.papers.filter(p => !isKnown(p.url)).map(p => p.id)))
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (!data || selected.size === 0) return
    setImporting(true)
    setMessage(null)
    setError(null)

    const toImport = data.papers
      .filter(p => selected.has(p.id) && p.url)
      .map(p => ({
        title: p.title,
        summary: p.summary ?? p.keyFindings ?? '[Add annotation]',
        url: p.url as string,
        imageUrl: null,
        category: 'Research' as Category,
      }))

    if (toImport.length === 0) {
      setError('No selected papers had a usable URL.')
      setImporting(false)
      return
    }

    try {
      const res = await fetch('/api/import-briefing-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword: password, articles: toImport, rewriteWithAi: true }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Error ${res.status}`)
        return
      }
      const failed = (payload.results ?? []).filter((r: { ok: boolean }) => !r.ok).length
      setMessage(
        failed > 0
          ? `✓ Imported ${payload.added} of ${payload.attempted} (${failed} failed). Draft now has ${payload.articleCount} items.`
          : `✓ Imported ${payload.added} paper${payload.added === 1 ? '' : 's'}. Draft now has ${payload.articleCount} items.`,
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
            🔬 Import research papers
          </p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">
            Trending AI papers from arXiv and Hugging Face, pulled from your Notion research database.
            Pre-checked — uncheck anything you don&apos;t want.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <a
            href={NOTION_RESEARCH_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-ws-accent underline hover:no-underline font-medium"
          >
            Open in Notion ↗
          </a>
          <button
            type="button"
            onClick={() => load(currentDate())}
            disabled={loading}
            className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent disabled:opacity-50"
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2">
        <label htmlFor="research-date" className="text-[12px] font-black uppercase tracking-[0.1em] shrink-0">
          Date
        </label>
        <input
          ref={dateInputRef}
          id="research-date"
          type="date"
          defaultValue={todayIso()}
          className="border-[2px] border-ws-black px-2 py-1 text-[13px] font-mono outline-none focus-visible:border-ws-accent"
        />
        <button
          type="button"
          onClick={() => load(currentDate())}
          disabled={loading}
          className="border-[2px] border-ws-black bg-ws-page px-3 py-1 text-[12px] font-black uppercase tracking-wide hover:bg-ws-black hover:text-ws-white disabled:opacity-50 transition-colors"
        >
          Load
        </button>
        <button
          type="button"
          onClick={() => {
            const t = todayIso()
            if (dateInputRef.current) dateInputRef.current.value = t
            load(t)
          }}
          disabled={loading}
          className="text-[12px] text-ws-black/50 underline hover:no-underline hover:text-ws-accent disabled:opacity-50"
        >
          Today
        </button>
      </div>

      {error && <p className="text-[14px] font-bold text-ws-accent">{error}</p>}
      {message && <p className="text-[14px] font-bold text-ws-black">{message}</p>}

      {loading && !data && <p className="text-[14px] text-ws-black/70">Loading research papers…</p>}

      {data && !loading && data.papers.length === 0 && (
        <div className="border border-ws-black/15 px-4 py-5 text-center flex flex-col gap-2">
          <p className="text-[14px] font-black uppercase tracking-wide">No papers for {data.date} yet</p>
          <p className="text-[13px] text-ws-black/60">
            Papers will appear here once they&apos;re added to the Notion database with today&apos;s date.
          </p>
          <a
            href={NOTION_RESEARCH_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-ws-accent underline hover:no-underline font-bold"
          >
            Open research database in Notion ↗
          </a>
        </div>
      )}

      {data && data.papers.length > 0 && (
        <>
          {/* Select-all / deselect-all */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set(data.papers.map(p => p.id)))}
              className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
            >
              Select all
            </button>
            <span className="text-ws-black/30">·</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[12px] font-bold uppercase tracking-wide underline hover:no-underline hover:text-ws-accent"
            >
              Deselect all
            </button>
            <span className="text-ws-black/50 text-[12px] ml-auto">{selected.size} of {data.papers.length} selected</span>
          </div>

          {/* Duplicate banner */}
          {(() => {
            const dupeCount = data.papers.filter(p => isKnown(p.url)).length
            if (dupeCount === 0) return null
            return (
              <p className="border-[2px] border-ws-accent bg-ws-accent/10 px-4 py-3 text-[13px] font-bold">
                ⚠ <strong>{dupeCount} paper{dupeCount === 1 ? '' : 's'}</strong> already published in the last {windowDays} days — pre-unchecked. Re-check any you want to include anyway.
              </p>
            )
          })()}

          {/* Paper list */}
          <div className="flex flex-col gap-3">
            {data.papers.map(paper => {
              const checked = selected.has(paper.id)
              const dupe = isKnown(paper.url)
              return (
                <label
                  key={paper.id}
                  className={`flex gap-3 p-3 border-[2px] cursor-pointer transition-colors ${
                    checked ? 'border-ws-black bg-ws-white' : 'border-ws-black/20 bg-ws-page opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(paper.id)}
                    className="mt-1 shrink-0 w-4 h-4 accent-ws-accent"
                  />
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-[14px] font-black leading-snug">
                      {paper.title}
                      {dupe && (
                        <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-ws-accent border border-ws-accent px-1.5 py-0.5 align-middle">
                          ⚠ Already published
                        </span>
                      )}
                    </p>

                    {paper.area.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {paper.area.map(tag => (
                          <span
                            key={tag}
                            className="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 border border-ws-black/30 text-ws-black/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {(paper.summary || paper.keyFindings) && (
                      <p className="text-[13px] text-ws-black/70 leading-snug line-clamp-3">
                        {paper.summary ?? paper.keyFindings}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {paper.authors && (
                        <span className="text-[11px] text-ws-black/50 truncate max-w-[260px]">{paper.authors}</span>
                      )}
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-ws-accent underline hover:no-underline font-bold shrink-0"
                        >
                          {paper.arXivId ? `arXiv:${paper.arXivId}` : paper.source ?? 'View paper'} ↗
                        </a>
                      )}
                      {paper.hfUrl && paper.arXivId && (
                        <a
                          href={paper.hfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-ws-black/50 underline hover:no-underline hover:text-ws-accent shrink-0"
                        >
                          HF ↗
                        </a>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>

          {/* Import button */}
          <div className="flex items-center gap-4 flex-wrap border-t border-ws-black/10 pt-4">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Importing…
                </>
              ) : (
                `Import ${selected.size} paper${selected.size === 1 ? '' : 's'} → Research section`
              )}
            </button>
            <p className="text-[12px] text-ws-black/50">Added under <strong>## Research</strong> in today&apos;s draft.</p>
          </div>
        </>
      )}
    </div>
  )
}
