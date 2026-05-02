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
    <div className="border-[3px] border-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-ws-page"
      >
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.15em] text-ws-black/70">Add articles while browsing</p>
          {!open && <p className="text-[12px] text-ws-black/50 mt-0.5">Scan a QR code to capture from your phone, or grab the desktop bookmarklet. Set up once, capture anywhere.</p>}
        </div>
        <span className="text-[12px] font-bold uppercase tracking-wide text-ws-black/70 shrink-0">
          {open ? '− Hide' : '+ Show'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-6 border-t-[2px] border-ws-black/20 pt-5">
          {/* Easiest: mobile capture page + QR code */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">📱 Easiest — on your phone</p>
            <p className="text-[13px] text-ws-black/70">
              Scan the QR code with your phone camera. The capture page opens — paste any article URL and tap Save.
              <br />
              <strong>Pro tip:</strong> in Safari, tap <em>Share</em> → <em>Add to Home Screen</em> for one-tap access from your home screen.
            </p>
            <div className="flex items-start gap-4 flex-wrap">
              {origin && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(`${origin}/capture`)}`}
                  alt="QR code to capture page"
                  width={180}
                  height={180}
                  className="border-[2px] border-ws-black shrink-0"
                />
              )}
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <p className="text-[12px] font-black uppercase tracking-wide text-ws-black/60">Or open this URL on any device:</p>
                <a
                  href="/capture"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-mono break-all underline hover:no-underline text-ws-accent font-bold"
                >
                  {origin}/capture
                </a>
                <p className="text-[12px] text-ws-black/60 mt-1">
                  No setup, no token, no shortcut to configure. Just paste a URL and Save — same flow as the manual paste box on this page.
                </p>
              </div>
            </div>
          </div>

          {/* Bookmarklet — also easy */}
          <div className="flex flex-col gap-3 border-t border-ws-black/15 pt-5">
            <p className="text-[13px] font-black uppercase tracking-[0.1em]">💻 Desktop — one-click bookmarklet</p>
            <p className="text-[13px] text-ws-black/70">
              Drag the button below to your browser&apos;s bookmarks bar. Then while reading any article, click it — done.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={bookmarkletCode}
                onClick={e => e.preventDefault()}
                draggable
                className="border-[3px] border-ws-black bg-ws-accent-light text-ws-black font-black text-[14px] px-4 py-2 shadow-[3px_3px_0_0_var(--color-ws-black)] cursor-grab select-none hover:bg-ws-page"
              >
                📌 Capture to AI Today
              </a>
              <button
                type="button"
                onClick={handleCopyBookmarklet}
                className="text-[13px] font-bold uppercase tracking-wide border-[2px] border-ws-black px-3 py-2 hover:bg-ws-page"
              >
                {bookmarkletCopied ? '✓ Copied!' : '📋 Copy code'}
              </button>
            </div>
          </div>

          {/* iOS Shortcut — hidden behind a disclosure */}
          <details className="border-t border-ws-black/15 pt-4">
            <summary className="cursor-pointer text-[12px] font-black uppercase tracking-[0.1em] text-ws-black/60 hover:text-ws-black select-none">
              ⚙️ Advanced — iOS Share Sheet shortcut (skip this; the QR code above is easier)
            </summary>
            <div className="flex flex-col gap-3 mt-4">
              <p className="text-[13px] text-ws-black/70">
                Set up a one-tap Share Sheet shortcut so you can add any article from Safari without opening a form — just tap Share → the shortcut. <em>Most people don&apos;t need this</em> — the home-screen shortcut from the QR code above is just as fast and requires zero setup.
              </p>
              <ol className="flex flex-col gap-2 text-[13px] pl-5 list-decimal">
                <li>Open <strong>Shortcuts</strong> → New shortcut → <strong>Add action</strong></li>
                <li>Search for <strong>&quot;Get URLs from Input&quot;</strong> — enable <em>Show in Share Sheet</em></li>
                <li>Add action: <strong>&quot;Get Contents of URL&quot;</strong></li>
                <li>Set URL to <code className="font-mono bg-ws-page px-1">{origin}/api/capture</code></li>
                <li>Method: <strong>POST</strong> · Request body: <strong>JSON</strong></li>
                <li>
                  Add fields:<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">token</code> → your <code className="font-mono bg-ws-page px-1 text-[12px]">CAPTURE_TOKEN</code> value<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">url</code> → <em>URLs</em> (from step 1)<br />
                  <code className="font-mono bg-ws-page px-1 text-[12px]">autoAnnotate</code> → <code className="font-mono bg-ws-page px-1 text-[12px]">true</code>
                </li>
                <li>Optional: add <strong>&quot;Show Result&quot;</strong> to display the returned article title</li>
              </ol>
              <p className="text-[12px] text-ws-black/50">
                The <code className="font-mono bg-ws-page px-1">CAPTURE_TOKEN</code> is set in your Vercel environment variables.
              </p>
              <details className="text-[12px]">
                <summary className="cursor-pointer text-ws-black/70 hover:text-ws-black font-bold uppercase tracking-wide">
                  Show raw bookmarklet code
                </summary>
                <pre className="mt-2 p-3 bg-ws-page border border-ws-black/20 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all">
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
