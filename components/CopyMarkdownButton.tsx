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
      className="inline-flex items-center gap-2 border-[3px] border-neopop-black bg-neopop-white text-ws-black font-black text-[14px] uppercase tracking-wide px-4 py-2 shadow-[4px_4px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--color-neopop-black)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_0_var(--color-neopop-black)]"
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
