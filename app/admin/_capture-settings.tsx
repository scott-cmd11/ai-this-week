'use client'

import { useState } from 'react'

export function CaptureSettings() {
  const [open, setOpen] = useState(false)
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const bookmarkletCode = `javascript:(function(){window.open('${origin}/capture?url='+encodeURIComponent(location.href),'capture','width=520,height=640')})()`

  async function handleCopyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarkletCode)
      setBookmarkletCopied(true)
      setTimeout(() => setBookmarkletCopied(false), 2500)
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="admin-subpanel bg-ws-white">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-ws-page"
      >
        <div>
          <p className="admin-eyebrow">Add articles while browsing</p>
          {!open && (
            <p className="mt-1 text-[12px] text-ws-black/50">
              Scan a QR code to capture from your phone, or grab the desktop bookmarklet. Set up once, capture anywhere.
            </p>
          )}
        </div>
        <span className="shrink-0 text-[12px] font-black uppercase tracking-[0.08em] text-ws-black/60">
          {open ? 'Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-6 border-t border-ws-border px-5 pb-5 pt-5">
          <div className="flex flex-col gap-3">
            <p className="admin-field-label">Easiest on your phone</p>
            <p className="text-[13px] text-ws-black/70">
              Scan the QR code with your phone camera. The capture page opens, then paste any article URL and tap Save.
              <br />
              <strong>Pro tip:</strong> in Safari, tap Share, then Add to Home Screen for one-tap access.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              {origin && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(`${origin}/capture`)}`}
                  alt="QR code to capture page"
                  width={180}
                  height={180}
                  className="shrink-0 rounded-[0.5rem] border border-ws-border"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="admin-field-label">Or open this URL on any device</p>
                <a
                  href="/capture"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-[14px] font-bold text-ws-accent underline hover:no-underline"
                >
                  {origin}/capture
                </a>
                <p className="mt-1 text-[12px] text-ws-black/60">
                  No setup, no token, no shortcut to configure. Just paste a URL and Save.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-ws-border pt-5">
            <p className="admin-field-label">Desktop bookmarklet</p>
            <p className="text-[13px] text-ws-black/70">
              Drag the button below to your browser&apos;s bookmarks bar. Then while reading any article, click it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={bookmarkletCode}
                onClick={event => event.preventDefault()}
                draggable
                className="admin-button-secondary cursor-grab select-none px-4 py-2 text-[14px] font-black"
              >
                Capture to AI Today
              </a>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="admin-button-secondary px-3 py-2 text-[13px] font-bold uppercase tracking-wide"
              >
                {bookmarkletCopied ? 'Copied' : 'Copy code'}
              </button>
            </div>
          </div>

          <details className="border-t border-ws-border pt-4">
            <summary className="cursor-pointer select-none text-[12px] font-black uppercase tracking-[0.1em] text-ws-black/60 hover:text-ws-black">
              Advanced iOS Share Sheet shortcut
            </summary>
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[13px] text-ws-black/70">
                Set up a one-tap Share Sheet shortcut so you can add any article from Safari without opening a form.
                Most people do not need this; the home-screen shortcut from the QR code above is just as fast.
              </p>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px]">
                <li>Open <strong>Shortcuts</strong>, create a new shortcut, then add an action.</li>
                <li>Search for <strong>&quot;Get URLs from Input&quot;</strong> and enable <em>Show in Share Sheet</em>.</li>
                <li>Add action: <strong>&quot;Get Contents of URL&quot;</strong></li>
                <li>Set URL to <code className="bg-ws-page px-1 font-mono">{origin}/api/capture</code></li>
                <li>Method: <strong>POST</strong>. Request body: <strong>JSON</strong></li>
                <li>
                  Add fields:<br />
                  <code className="bg-ws-page px-1 font-mono text-[12px]">token</code> to your <code className="bg-ws-page px-1 font-mono text-[12px]">CAPTURE_TOKEN</code> value<br />
                  <code className="bg-ws-page px-1 font-mono text-[12px]">url</code> to <em>URLs</em> from step 1<br />
                  <code className="bg-ws-page px-1 font-mono text-[12px]">autoAnnotate</code> to <code className="bg-ws-page px-1 font-mono text-[12px]">true</code>
                </li>
                <li>Optional: add <strong>&quot;Show Result&quot;</strong> to display the returned article title.</li>
              </ol>
              <p className="text-[12px] text-ws-black/50">
                The <code className="bg-ws-page px-1 font-mono">CAPTURE_TOKEN</code> is set in your Vercel environment variables.
              </p>
              <details className="text-[12px]">
                <summary className="cursor-pointer font-bold uppercase tracking-wide text-ws-black/70 hover:text-ws-black">
                  Show raw bookmarklet code
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all border border-ws-border bg-ws-page p-3 font-mono text-[11px]">
                  {bookmarkletCode}
                </pre>
              </details>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
