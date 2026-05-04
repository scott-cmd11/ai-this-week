'use client'

import { useState } from 'react'

interface Props {
  markdown: string
}

export function CopyMarkdownButton({ markdown }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ws-border bg-ws-white px-4 py-2 text-[13px] font-semibold tracking-wide text-ws-black shadow-[0_10px_24px_rgba(20,17,15,0.06)] transition-[border-color,background-color,color,box-shadow] duration-150 hover:border-ws-accent/45 hover:bg-[#fffaf0] hover:text-ws-accent focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2"
      aria-live="polite"
    >
      {copied ? (
        <>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied as markdown!
        </>
      ) : (
        <>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Copy as markdown
        </>
      )}
    </button>
  )
}
