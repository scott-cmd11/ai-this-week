'use client'

import { useState, useEffect } from 'react'

export default function BookmarkletPage() {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [tested, setTested] = useState(false)

  useEffect(() => {
    // Intentional: read window.location.origin once after hydration so the
    // initial server-rendered HTML doesn't include it (avoids SSR mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin)
  }, [])

  // The bookmarklet opens /admin?add={currentUrl} in a new tab
  const bookmarkletCode = origin
    ? `javascript:(function(){window.open('${origin}/admin?add='+encodeURIComponent(location.href),'_blank')})();`
    : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookmarkletCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  function handleTest() {
    if (!origin) return
    setTested(true)
    window.open(`${origin}/admin?add=${encodeURIComponent('https://example.com/test-article')}`, '_blank')
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <a href="/admin" className="text-[14px] text-govuk-blue underline hover:no-underline">
          ← Back to admin
        </a>
        <h1 className="text-[32px] font-bold text-govuk-black mt-4">Mobile bookmarklet</h1>
        <p className="text-[17px] text-govuk-dark-grey mt-2">
          Save articles to AI This Week from any browser on any device — one tap while reading.
        </p>
      </div>

      {/* How it works */}
      <div className="flex flex-col gap-2">
        <h2 className="text-[22px] font-bold text-govuk-black">How it works</h2>
        <p className="text-[17px] text-govuk-dark-grey">
          When you&apos;re reading an article you want to add to the newsletter, tap the bookmarklet.
          It opens the admin with that URL pre-filled and AI-suggested section ready to confirm.
        </p>
      </div>

      {/* The bookmarklet URL */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[22px] font-bold text-govuk-black">The bookmarklet</h2>
        <p className="text-[15px] text-govuk-dark-grey">
          This is the JavaScript code you save as a bookmark URL. It only works for <strong>{origin || 'this admin'}</strong>.
        </p>
        <div className="border-2 border-govuk-black p-3 bg-govuk-light-grey">
          <code className="text-[12px] text-govuk-black break-all font-mono leading-relaxed">
            {bookmarkletCode || 'Loading…'}
          </code>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleCopy}
            disabled={!bookmarkletCode}
            className="bg-govuk-black text-white font-bold text-[15px] px-4 py-2 hover:bg-govuk-dark-grey disabled:opacity-50"
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
          <button
            onClick={handleTest}
            disabled={!origin}
            className="border-2 border-govuk-black text-govuk-black font-bold text-[15px] px-4 py-2 hover:bg-govuk-light-grey disabled:opacity-50"
          >
            Test it
          </button>
        </div>
        {tested && (
          <p className="text-[14px] text-govuk-dark-grey">
            Opened the admin with a test URL — you should see it pre-filled in Quick Add.
          </p>
        )}
      </div>

      {/* iOS Safari instructions */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[22px] font-bold text-govuk-black">iOS Safari setup</h2>
        <ol className="flex flex-col gap-3 list-none">
          {[
            { n: 1, text: 'Copy the bookmarklet code above.' },
            { n: 2, text: 'Open Safari and go to any website (e.g. apple.com).' },
            { n: 3, text: 'Tap the Share button (square with arrow) at the bottom of the screen.' },
            { n: 4, text: 'Scroll down and tap "Add Bookmark". Give it a name like "Add to AI This Week". Tap Save.' },
            { n: 5, text: 'Open Bookmarks (book icon), find the bookmark you just saved, and tap Edit.' },
            { n: 6, text: 'Clear the URL field and paste the bookmarklet code you copied. Tap Done.' },
          ].map(({ n, text }) => (
            <li key={n} className="flex gap-3">
              <span className="font-bold text-[17px] text-govuk-black bg-govuk-light-grey border border-govuk-mid-grey rounded-full w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 text-[14px]">
                {n}
              </span>
              <p className="text-[17px] text-govuk-dark-grey">{text}</p>
            </li>
          ))}
        </ol>
        <div className="bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3">
          <p className="text-[15px] text-govuk-black">
            <strong>To use it:</strong> when reading an article in Safari, open Bookmarks and tap &ldquo;Add to AI This Week&rdquo;.
            The admin opens in a new tab with the article URL pre-filled.
          </p>
        </div>
      </div>

      {/* Chrome / Android instructions */}
      <div className="flex flex-col gap-4">
        <h2 className="text-[22px] font-bold text-govuk-black">Chrome (desktop or Android)</h2>
        <ol className="flex flex-col gap-3 list-none">
          {[
            { n: 1, text: 'Copy the bookmarklet code above.' },
            { n: 2, text: 'Press Ctrl+D (or Cmd+D on Mac) to bookmark any page, then click "Edit".' },
            { n: 3, text: 'Replace the URL with the bookmarklet code. Save.' },
            { n: 4, text: 'On Android: in Chrome, tap the three dots → Bookmarks → find the bookmark → long press → Edit URL and paste the code.' },
          ].map(({ n, text }) => (
            <li key={n} className="flex gap-3">
              <span className="font-bold text-[17px] text-govuk-black bg-govuk-light-grey border border-govuk-mid-grey rounded-full w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 text-[14px]">
                {n}
              </span>
              <p className="text-[17px] text-govuk-dark-grey">{text}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* iOS Shortcuts alternative */}
      <div className="flex flex-col gap-3">
        <h2 className="text-[22px] font-bold text-govuk-black">iOS Shortcuts (easier on iPhone)</h2>
        <p className="text-[17px] text-govuk-dark-grey">
          The iOS Shortcuts app lets you add a &ldquo;Share&rdquo; action that appears in the system share sheet — even easier than a bookmarklet.
        </p>
        <ol className="flex flex-col gap-3 list-none">
          {[
            { n: 1, text: 'Open the Shortcuts app on your iPhone.' },
            { n: 2, text: 'Tap + to create a new shortcut.' },
            { n: 3, text: 'Add an "Open URL" action.' },
            { n: 4, text: `Set the URL to: ${origin}/admin?add=` },
            { n: 5, text: 'Before the URL, add a "Get Current URL" action from the Share Sheet.' },
            { n: 6, text: 'Enable "Show in Share Sheet" in shortcut settings. Name it "Add to AI This Week".' },
          ].map(({ n, text }) => (
            <li key={n} className="flex gap-3">
              <span className="font-bold text-[17px] text-govuk-black bg-govuk-light-grey border border-govuk-mid-grey rounded-full w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 text-[14px]">
                {n}
              </span>
              <p className="text-[17px] text-govuk-dark-grey font-mono text-[15px]">{n === 4 ? <code>{text}</code> : text}</p>
            </li>
          ))}
        </ol>
        <div className="bg-govuk-light-grey border-l-4 border-govuk-mid-grey px-4 py-3">
          <p className="text-[15px] text-govuk-black">
            <strong>To use it:</strong> tap Share on any article, scroll to &ldquo;Add to AI This Week&rdquo;, tap it.
            The admin opens with the URL ready.
          </p>
        </div>
      </div>
    </div>
  )
}
