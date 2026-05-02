'use client'

import { useState, useEffect } from 'react'

export function WorkflowGuide() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('aitoday:workflow-guide-open')
    if (stored === 'closed') setOpen(false)
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('aitoday:workflow-guide-open', next ? 'open' : 'closed')
  }

  return (
    <div className="mt-6 border-[3px] border-ws-black bg-ws-page shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-accent-light/40"
      >
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black">How this works</p>
          {!open && (
            <p className="text-[12px] text-ws-black/60 mt-0.5">
              Import → Publish. Click to expand the full guide (~5 min).
            </p>
          )}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">
          {open ? '− Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t-[2px] border-ws-black/15 flex flex-col gap-5 text-[14px] leading-[1.55]">
          <p className="text-ws-black/80">
            Each morning four Notion sources auto-generate:{' '}
            <strong>Canada AI Daily</strong>, <strong>Agriculture AI</strong>,{' '}
            <strong>Daily News – AI</strong>, and <strong>Trending AI Research</strong>.
            The flow below takes about 5 minutes.
          </p>

          <ol className="flex flex-col gap-4 list-none p-0 m-0">
            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">1</span>
              <div>
                <p className="font-black text-[14px] mb-1">Import today&apos;s content</p>
                <p className="text-ws-black/70">
                  Three panels below feed today&apos;s draft. Each is pre-checked — uncheck anything
                  you don&apos;t want, then click the import button at the bottom of each:
                </p>
                <ul className="text-ws-black/70 list-disc pl-5 mt-1.5 flex flex-col gap-1">
                  <li><strong>Import from briefings</strong> — news articles grouped into 5 categories (Canada · Policy · Government · Industry · Sectors)</li>
                  <li><strong>🔬 Import research papers</strong> — trending arXiv / Hugging Face papers</li>
                  <li><strong>Add a learning event</strong> — paste an event URL and AI auto-fills the title, date, location, and description (you can edit before saving)</li>
                </ul>
                <p className="text-ws-black/60 mt-1.5 text-[13px]">
                  <strong>Voice consistency:</strong> by default, every imported summary (from briefings,
                  research, events, or manual pastes) is rewritten by GPT in the AI Today voice — plain
                  language, active verbs, no jargon. So the published issue reads as one consistent
                  voice instead of a patchwork of source styles. Adds ~2–3 sec per article.
                  Toggle off the rewrite on briefings if you&apos;re in a rush.
                </p>
                <p className="text-ws-black/60 mt-1 text-[13px]">
                  Anything already published in the last 30 days shows a <strong>⚠ Already published</strong> badge and is pre-unchecked, so you don&apos;t accidentally repeat yourself.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">2</span>
              <div>
                <p className="font-black text-[14px] mb-1">Review &amp; publish</p>
                <p className="text-ws-black/70">
                  Scroll to <strong>Today&apos;s draft</strong> to see everything you imported. Spotted
                  a great article elsewhere? Paste its URL right there — AI writes the summary.
                  When it looks right, click <strong>Publish now</strong> at the top of that panel.
                  The issue goes live on the public site immediately.
                </p>
              </div>
            </li>

          </ol>

          <div className="border-t-[1px] border-ws-black/15 pt-3 text-[13px] text-ws-black/60">
            <p>
              <strong>Catching articles on the go?</strong> Open <em>Add articles while browsing</em>{' '}
              at the bottom of this page — scan the QR code with your phone, or grab the desktop bookmarklet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
