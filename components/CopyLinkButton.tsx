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
      className="inline-flex items-center gap-2 border-2 border-govuk-black dark:border-govuk-mid-grey text-govuk-black dark:text-white font-bold text-[15px] px-4 py-2 hover:bg-govuk-light-grey"
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
