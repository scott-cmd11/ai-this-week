'use client'

import { useState } from 'react'

interface Props {
  url?: string   // if omitted, copies window.location.href
  label?: string
}

export function CopyLinkButton({ url, label = 'Copy link' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      const target = url ?? window.location.href
      await navigator.clipboard.writeText(target)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked — silently ignore */ }
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
          Copied!
        </>
      ) : (
        <>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="1" width="9" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 12v2a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1h2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
