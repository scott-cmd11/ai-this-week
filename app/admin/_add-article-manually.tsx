'use client'

import { useState } from 'react'
import { CATEGORY_ORDER, CATEGORY_META, type Category } from '@/lib/category-mapping'

export function AddArticleManually({
  password,
  targetIssueId,
  targetIssueLabel = "today's issue",
}: {
  password: string
  targetIssueId?: string
  targetIssueLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [addUrl, setAddUrl] = useState('')
  const [addAnnotation, setAddAnnotation] = useState('')
  const [addImageUrl, setAddImageUrl] = useState('')
  const [addCategory, setAddCategory] = useState<Category>('Canada')
  const [showImageField, setShowImageField] = useState(false)
  const [polishMyNote, setPolishMyNote] = useState(true)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    issueNumber: number
    issueDate: string
    published: boolean
  } | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function submitAddArticle(force: boolean) {
    setAddLoading(true)
    setAddError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: password,
          url: addUrl.trim(),
          annotation: addAnnotation.trim() || undefined,
          imageUrl: addImageUrl.trim() || undefined,
          autoAnnotate: !addAnnotation.trim(),
          polishAnnotation: !!addAnnotation.trim() && polishMyNote,
          category: addCategory,
          targetIssueId,
          force,
        }),
      })
      const data = await res.json()

      if (res.status === 409 && data.duplicate) {
        setDuplicateWarning(data.duplicate)
        return
      }
      if (!res.ok) {
        setAddError(data.error ?? `Error ${res.status}`)
        return
      }

      setAddUrl('')
      setAddAnnotation('')
      setAddImageUrl('')
      setShowImageField(false)
      setDuplicateWarning(null)
      setSuccess(`✓ Added to ${targetIssueLabel} under ${addCategory}.`)
      setTimeout(() => setSuccess(null), 4000)
      window.dispatchEvent(new CustomEvent('aitoday:refresh-draft'))
    } catch {
      setAddError('Network error — check your connection.')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleAddArticle(e: React.FormEvent) {
    e.preventDefault()
    if (!addUrl.trim()) return
    setDuplicateWarning(null)
    await submitAddArticle(false)
  }

  if (!open) {
    return (
      <div className="border-[3px] border-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-page"
        >
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add an article manually</p>
            <p className="text-[12px] text-ws-black/50 mt-0.5">Paste a URL to add anything you saw elsewhere. Leave the note blank and AI writes the summary for you.</p>
          </div>
          <span className="text-[12px] font-medium text-ws-black/50 shrink-0">+ Show</span>
        </button>
      </div>
    )
  }

  return (
    <div className="border-[3px] border-ws-black bg-ws-white p-5 shadow-[4px_4px_0_0_var(--color-ws-black)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add an article manually</p>
          <p className="text-[12px] text-ws-black/50 mt-0.5">Paste any URL. Leave the note blank and AI writes the summary for you.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-medium text-ws-black/50 hover:underline hover:text-ws-accent shrink-0"
        >
          Hide
        </button>
      </div>

      {success && (
        <p className="text-[13px] font-bold text-ws-black border-[2px] border-ws-black bg-ws-accent-light/40 px-3 py-2">{success}</p>
      )}

      <form onSubmit={handleAddArticle} noValidate className="flex flex-col gap-4">
        {/* URL */}
        <div>
          <label htmlFor="today-url" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            URL <span className="text-ws-accent" aria-hidden="true">*</span>
          </label>
          <input
            id="today-url"
            type="url"
            required
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            placeholder="https://…"
            disabled={addLoading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
          />
        </div>

        {/* Annotation */}
        <div>
          <label htmlFor="today-note" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Your note <span className="text-ws-muted font-normal normal-case tracking-normal">(optional — leave blank for AI to write it)</span>
          </label>
          <textarea
            id="today-note"
            value={addAnnotation}
            onChange={e => setAddAnnotation(e.target.value)}
            placeholder="Leave blank and AI writes a summary — or type your own"
            rows={2}
            disabled={addLoading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] leading-[1.5] resize-y outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          />
          {addAnnotation.trim() && (
            <label className="mt-2 flex items-start gap-2 cursor-pointer select-none text-[12px] text-ws-black/70">
              <input
                type="checkbox"
                checked={polishMyNote}
                onChange={e => setPolishMyNote(e.target.checked)}
                disabled={addLoading}
                className="mt-0.5 w-4 h-4 accent-ws-black cursor-pointer shrink-0"
              />
              <span>
                <strong>Polish my note in the AI Today voice.</strong> GPT lightly rewrites your text using the same plain-language rules as the rest of the issue — keeps your meaning, tightens the prose. Adds ~1 sec.
              </span>
            </label>
          )}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="today-category" className="block text-[12px] font-black uppercase tracking-[0.1em] mb-1.5">
            Category <span className="text-ws-muted font-normal normal-case tracking-normal">(which section it goes in)</span>
          </label>
          <select
            id="today-category"
            value={addCategory}
            onChange={e => setAddCategory(e.target.value as Category)}
            disabled={addLoading}
            className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60"
          >
            {CATEGORY_ORDER.map(c => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {c}</option>
            ))}
          </select>
        </div>

        {/* Image URL (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowImageField(v => !v)}
            className="text-[12px] font-medium text-ws-accent hover:underline flex items-center gap-1"
            aria-expanded={showImageField}
          >
            <span aria-hidden="true">{showImageField ? '−' : '+'}</span>
            {showImageField ? 'Hide image URL' : 'Add image URL'}
          </button>
          {showImageField && (
            <div className="mt-2">
              <input
                type="url"
                value={addImageUrl}
                onChange={e => setAddImageUrl(e.target.value)}
                placeholder="https://… (overrides auto-fetched og:image)"
                disabled={addLoading}
                className="w-full border-[3px] border-ws-black bg-ws-page px-3 py-2.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ws-accent disabled:opacity-60 font-mono"
              />
              {addImageUrl && (
                <div className="mt-2 border-[2px] border-ws-black overflow-hidden w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={addImageUrl}
                    alt="Preview"
                    className="w-32 h-20 object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {addError && (
          <div role="alert" className="border-[3px] border-ws-black bg-red-50 px-3 py-2 text-[14px] font-bold text-red-700">
            {addError}
          </div>
        )}

        {duplicateWarning && (
          <div role="alert" className="border-[3px] border-ws-accent bg-ws-accent-light/40 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <span className="text-[16px]" aria-hidden="true">⚠</span>
              <p className="text-[14px] text-ws-black leading-snug">
                This URL was already added to <strong>Issue #{duplicateWarning.issueNumber}</strong> on{' '}
                <strong>{duplicateWarning.issueDate}</strong>{' '}
                ({duplicateWarning.published ? 'published' : 'draft'}). Add it again only if you mean to.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => submitAddArticle(true)}
                disabled={addLoading}
                className="border-[2px] border-ws-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[12px] px-3 py-1.5 hover:bg-ws-accent-hover disabled:opacity-50"
              >
                Add anyway
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="text-[12px] font-medium text-ws-black/60 hover:underline hover:text-ws-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={addLoading || !addUrl.trim() || !!duplicateWarning}
          className="border-[3px] border-ws-black bg-ws-black text-ws-white font-black uppercase tracking-wide text-[14px] px-5 py-3 self-start shadow-[4px_4px_0_0_var(--color-ws-accent)] transition-[transform,box-shadow] duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_var(--color-ws-accent)] hover:bg-ws-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {addLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-ws-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Adding…
            </>
          ) : (
            `+ Add to ${targetIssueLabel}`
          )}
        </button>
      </form>
    </div>
  )
}
