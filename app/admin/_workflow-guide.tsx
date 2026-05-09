'use client'

import { useState } from 'react'

export function WorkflowGuide() {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('aitoday:workflow-guide-open') === 'open'
  })

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
              Review candidates, draft, publish, then make live edits.
            </p>
          )}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">
          {open ? '- Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t-[2px] border-ws-black/15 flex flex-col gap-5 text-[14px] leading-[1.55]">
          <p className="text-ws-black/80">
            Each morning the automations send article candidates into Supabase.
            The admin flow is the publishing source of truth: review the queue,
            add the best items to the draft, publish, then make live corrections if needed.
          </p>

          <ol className="flex flex-col gap-4 list-none p-0 m-0">
            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">1</span>
              <div>
                <p className="font-black text-[14px] mb-1">Review candidates</p>
                <p className="text-ws-black/70">
                  Start with Candidate Inbox. Open the source, confirm the category, reject clear noise,
                  then add the keepers to today&apos;s draft.
                </p>
                <ul className="text-ws-black/70 list-disc pl-5 mt-1.5 flex flex-col gap-1">
                  <li><strong>Candidate Inbox</strong> is the normal article review path.</li>
                  <li><strong>Add Context</strong> is optional for research papers or reports.</li>
                  <li><strong>Add Events</strong> is optional for learning events that belong in today&apos;s issue.</li>
                </ul>
                <p className="text-ws-black/60 mt-1.5 text-[13px]">
                  Candidate imports use the AI Today rewrite path so the published issue reads as one edited product.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="font-black text-ws-accent text-[20px] leading-none shrink-0 w-6">2</span>
              <div>
                <p className="font-black text-[14px] mb-1">Edit, publish, correct</p>
                <p className="text-ws-black/70">
                  Open <strong>Edit Draft</strong> to see everything you imported. Add missing articles manually before publishing.
                  When it looks right, open <strong>Publish</strong> and click <strong>Publish now</strong>.
                  The issue goes live on the public site immediately, and <strong>Live Edits</strong> handles corrections.
                </p>
              </div>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
