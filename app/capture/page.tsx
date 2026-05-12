'use client'

import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'

interface CaptureResult {
  title?: string
  issueNumber?: number
  articlesTotal?: number
}

function CaptureInner() {
  const searchParams = useSearchParams()
  const prefillUrl = searchParams.get('url') ?? ''

  const [token, setToken] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [tokenSet, setTokenSet] = useState(false)
  const [url, setUrl] = useState(prefillUrl)
  const [annotation, setAnnotation] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [showImageField, setShowImageField] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<{ issueNumber: number; issueDate: string; published: boolean } | null>(null)

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

  async function submitCapture(force: boolean) {
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
          force,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.duplicate) {
        setDuplicate(data.duplicate)
      } else if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
      } else {
        setResult(data)
        setDuplicate(null)
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setDuplicate(null)
    await submitCapture(false)
  }

  function handleAddAnother() {
    setUrl('')
    setAnnotation('')
    setImageUrl('')
    setShowImageField(false)
    setResult(null)
    setError(null)
    setDuplicate(null)
  }

  if (!tokenSet) {
    return (
      <CaptureShell eyebrow="Capture setup" title="Save article links to the issue desk.">
        <div className="admin-panel bg-ws-white p-5 sm:p-6">
          <p className="admin-copy max-w-xl">
            Enter your capture token once on this device. The token is stored locally and only grants article-capture access.
          </p>
          <div className="mt-5">
            <label htmlFor="capture-token" className="admin-field-label">Capture token</label>
            <input
              id="capture-token"
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveToken()}
              placeholder="Paste your token here"
              autoFocus
              className="admin-input px-4 py-3 font-mono text-[16px]"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveToken}
            disabled={!tokenInput.trim()}
            className="admin-button-primary mt-5 w-full px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save token
          </button>
        </div>
      </CaptureShell>
    )
  }

  if (result) {
    return (
      <CaptureShell eyebrow="Saved" title="Article added.">
        <div className="admin-panel bg-ws-white p-5 sm:p-6">
          {result.title && (
            <p className="font-[family-name:var(--font-display)] text-[1.55rem] font-semibold leading-tight text-ws-black">
              {result.title}
            </p>
          )}
          <p className="admin-copy mt-3">
            {result.issueNumber != null && result.articlesTotal != null
              ? `Added to Issue ${result.issueNumber}. The draft now has ${result.articlesTotal} article${result.articlesTotal === 1 ? '' : 's'}.`
              : "Article saved to today's draft."}
          </p>
          <button
            type="button"
            onClick={handleAddAnother}
            className="admin-button-primary mt-5 w-full px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em]"
          >
            Add another
          </button>
        </div>
      </CaptureShell>
    )
  }

  return (
    <CaptureShell eyebrow="Capture" title="Add an article to today's issue.">
      <form onSubmit={handleSubmit} noValidate className="admin-panel bg-ws-white p-5 sm:p-6">
        <div className="grid gap-5">
          <div>
            <label htmlFor="cap-url" className="admin-field-label">Source URL</label>
            <input
              id="cap-url"
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="admin-input px-4 py-3 text-[16px]"
            />
          </div>

          <div>
            <label htmlFor="cap-note" className="admin-field-label">Note</label>
            <textarea
              id="cap-note"
              value={annotation}
              onChange={e => setAnnotation(e.target.value)}
              placeholder="Add a note, or leave blank for AI annotation."
              rows={3}
              className="admin-input resize-y px-4 py-3 text-[15px] leading-[1.5]"
            />
          </div>

          <div className="admin-subpanel p-4">
            <button
              type="button"
              onClick={() => setShowImageField(value => !value)}
              className="admin-button-ghost flex min-h-0 items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-ws-accent hover:text-ws-accent-hover"
              aria-expanded={showImageField}
            >
              <span aria-hidden="true">{showImageField ? '-' : '+'}</span>
              {showImageField ? 'Hide image URL' : 'Add image URL'}
            </button>

            {showImageField && (
              <div className="mt-4">
                <label htmlFor="cap-image" className="admin-field-label">Image URL</label>
                <input
                  id="cap-image"
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="admin-input px-4 py-3 text-[15px]"
                />
                {imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-[0.55rem] border border-ws-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Article image preview"
                      className="h-32 w-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="admin-danger-notice mt-5 rounded-[0.6rem] px-4 py-3">
            <p className="admin-field-label text-red-800">Capture error</p>
            <p className="mt-1 text-[14px] font-bold leading-snug">{error}</p>
          </div>
        )}

        {duplicate && (
          <div role="alert" className="mt-5 rounded-[0.6rem] border border-ws-accent/35 bg-ws-accent-light/45 px-4 py-3">
            <p className="text-[14px] font-bold leading-snug text-ws-black">
              Already added to <strong>Issue {duplicate.issueNumber}</strong> on{' '}
              <strong>{duplicate.issueDate}</strong> ({duplicate.published ? 'published' : 'draft'}).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void submitCapture(true)}
                disabled={loading}
                className="admin-button-primary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
              >
                Add anyway
              </button>
              <button
                type="button"
                onClick={() => setDuplicate(null)}
                className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !url.trim() || !!duplicate}
          className="admin-button-primary mt-5 w-full px-5 py-3 text-[13px] font-black uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Adding...' : "Add to today's issue"}
        </button>

        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('captureToken')
            setToken('')
            setTokenSet(false)
          }}
          className="admin-button-ghost mx-auto mt-4 block text-[12px] font-bold text-ws-muted hover:text-ws-black"
        >
          Reset token
        </button>
      </form>
    </CaptureShell>
  )
}

function CaptureShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="admin-workspace mx-auto max-w-md px-2 py-8">
      <header className="mb-5 border-t border-ws-black pt-5">
        <p className="admin-eyebrow text-ws-accent">{eyebrow}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.6rem] font-bold leading-[0.95] text-ws-black">
          {title}
        </h1>
      </header>
      {children}
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <CaptureShell eyebrow="Capture" title="Loading capture desk.">
          <div className="admin-panel bg-ws-white p-5 sm:p-6">
            <div className="h-8 w-40 animate-pulse rounded bg-ws-border" />
            <div className="mt-4 h-4 w-full animate-pulse rounded bg-ws-border" />
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-ws-border" />
          </div>
        </CaptureShell>
      }
    >
      <CaptureInner />
    </Suspense>
  )
}
