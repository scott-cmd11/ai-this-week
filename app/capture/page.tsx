'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

// ── Types ────────────────────────────────────────────────────────────────────

interface CaptureResult {
  title?: string
  issueNumber?: number
  articlesTotal?: number
}

// ── Inner component (needs useSearchParams) ──────────────────────────────────

function CaptureInner() {
  const searchParams = useSearchParams()
  const prefillUrl = searchParams.get('url') ?? ''

  // Auth
  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [tokenSet, setTokenSet] = useState(false)

  // Form
  const [url, setUrl] = useState(prefillUrl)
  const [annotation, setAnnotation] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [showImageField, setShowImageField] = useState(false)

  // Status
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('captureToken')
    if (stored) {
      setToken(stored)
      setTokenSet(true)
    }
  }, [])

  function handleSaveToken() {
    if (!tokenInput.trim()) return
    localStorage.setItem('captureToken', tokenInput.trim())
    setToken(tokenInput.trim())
    setTokenSet(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          url: url.trim(),
          annotation: annotation.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          autoAnnotate: !annotation.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
      } else {
        setResult(data)
      }
    } catch {
      setError('Network error — check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleAddAnother() {
    setUrl('')
    setAnnotation('')
    setImageUrl('')
    setShowImageField(false)
    setResult(null)
    setError(null)
  }

  // ── Token setup screen ────────────────────────────────────────────────────

  if (!tokenSet) {
    return (
      <div className="max-w-sm mx-auto pt-8 px-4">
        <div className="border-[3px] border-ws-black bg-ws-page shadow-[6px_6px_0_0_var(--color-ws-black)] p-6">
          <h1 className="text-[28px] font-black uppercase tracking-tight leading-tight mb-2">
            Capture Setup
          </h1>
          <div className="w-10 h-[3px] bg-ws-accent mb-5" aria-hidden="true" />
          <p className="text-[16px] leading-[1.5] mb-6 text-ws-muted">
            Enter your capture token to start saving articles.
          </p>
          <label className="block text-[12px] font-black uppercase tracking-[0.12em] mb-2">
            Capture Token
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveToken()}
            placeholder="Paste your token here"
            autoFocus
            className="w-full border-[3px] border-ws-black bg-ws-white px-4 py-3 text-[18px] font-mono mb-4 outline-none focus-visible:ring-2 focus-visible:ring-ws-accent"
          />
          <button
            type="button"
            onClick={handleSaveToken}
            disabled={!tokenInput.trim()}
            className="w-full border-[3px] border-ws-black bg-ws-accent text-ws-white px-5 py-3 text-[16px] font-black uppercase tracking-wide shadow-[4px_4px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Token
          </button>
        </div>
      </div>
    )
  }

  // ── Success panel ─────────────────────────────────────────────────────────

  if (result) {
    return (
      <div className="max-w-sm mx-auto pt-8 px-4">
        <div className="border-[3px] border-ws-black bg-ws-accent-light shadow-[6px_6px_0_0_var(--color-ws-black)] p-6">
          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-ws-accent mb-3">
            Saved
          </p>
          {result.title && (
            <p className="text-[18px] font-black leading-tight mb-3 text-ws-black">
              {result.title}
            </p>
          )}
          <p className="text-[15px] text-ws-muted mb-6">
            {result.issueNumber != null && result.articlesTotal != null
              ? `Added to Issue #${result.issueNumber} · ${result.articlesTotal} article${result.articlesTotal === 1 ? '' : 's'} today`
              : 'Article saved to today\'s draft.'}
          </p>
          <button
            type="button"
            onClick={handleAddAnother}
            className="w-full border-[3px] border-ws-black bg-ws-white text-ws-black px-5 py-3 text-[15px] font-black uppercase tracking-wide shadow-[4px_4px_0_0_var(--color-ws-black)] hover:bg-ws-page active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
          >
            Add Another
          </button>
        </div>
      </div>
    )
  }

  // ── Main capture form ─────────────────────────────────────────────────────

  return (
    <div className="max-w-sm mx-auto pt-8 px-4 pb-12">
      <div className="border-[3px] border-ws-black bg-ws-page shadow-[6px_6px_0_0_var(--color-ws-black)] p-6">
        <h1 className="text-[28px] font-black uppercase tracking-tight leading-tight mb-2">
          Add Article
        </h1>
        <div className="w-10 h-[3px] bg-ws-accent mb-6" aria-hidden="true" />

        <form onSubmit={handleSubmit} noValidate>
          {/* URL */}
          <div className="mb-5">
            <label
              htmlFor="cap-url"
              className="block text-[12px] font-black uppercase tracking-[0.12em] mb-2"
            >
              URL <span className="text-ws-accent" aria-hidden="true">*</span>
            </label>
            <input
              id="cap-url"
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border-[3px] border-ws-black bg-ws-white px-4 py-3 text-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent"
            />
          </div>

          {/* Annotation */}
          <div className="mb-5">
            <label
              htmlFor="cap-note"
              className="block text-[12px] font-black uppercase tracking-[0.12em] mb-2"
            >
              Note <span className="text-ws-muted font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              id="cap-note"
              value={annotation}
              onChange={e => setAnnotation(e.target.value)}
              placeholder="Add a note… or leave blank for AI annotation"
              rows={3}
              className="w-full border-[3px] border-ws-black bg-ws-white px-4 py-3 text-[16px] leading-[1.5] resize-y outline-none focus-visible:ring-2 focus-visible:ring-ws-accent"
            />
          </div>

          {/* Image URL (collapsible) */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowImageField(v => !v)}
              className="text-[12px] font-black uppercase tracking-[0.12em] text-ws-accent hover:text-ws-accent-hover flex items-center gap-1"
              aria-expanded={showImageField}
            >
              <span aria-hidden="true">{showImageField ? '−' : '+'}</span>
              {showImageField ? 'Hide image URL' : 'Add image URL'}
            </button>

            {showImageField && (
              <div className="mt-3">
                <label
                  htmlFor="cap-image"
                  className="block text-[12px] font-black uppercase tracking-[0.12em] mb-2"
                >
                  Image URL
                </label>
                <input
                  id="cap-image"
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full border-[3px] border-ws-black bg-ws-white px-4 py-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent mb-3"
                />
                {imageUrl && (
                  <div className="border-[3px] border-ws-black overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Article image preview"
                      className="w-full h-32 object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="border-[3px] border-ws-black bg-red-50 px-4 py-3 mb-5 text-[15px] font-bold text-red-700"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full border-[3px] border-ws-black bg-ws-accent text-ws-white px-5 py-4 text-[17px] font-black uppercase tracking-wide shadow-[4px_4px_0_0_var(--color-ws-black)] hover:bg-ws-accent-hover active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span
                  className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                Adding…
              </>
            ) : (
              'Add to today\'s issue'
            )}
          </button>
        </form>

        {/* Token reset */}
        <p className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('captureToken')
              setToken('')
              setTokenSet(false)
            }}
            className="text-[12px] text-ws-muted hover:text-ws-black underline"
          >
            Reset token
          </button>
        </p>
      </div>
    </div>
  )
}

// ── Page export (wraps inner in Suspense for useSearchParams) ─────────────────

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-sm mx-auto pt-8 px-4">
          <div className="border-[3px] border-ws-black bg-ws-page shadow-[6px_6px_0_0_var(--color-ws-black)] p-6">
            <div className="h-8 w-40 bg-ws-border animate-pulse mb-4" />
            <div className="h-4 w-full bg-ws-border animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-ws-border animate-pulse" />
          </div>
        </div>
      }
    >
      <CaptureInner />
    </Suspense>
  )
}
