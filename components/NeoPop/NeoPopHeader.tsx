import Link from 'next/link'

// Simplified 11-point maple leaf in Canada red.
// Kept small and restrained — the goal is a subtle national mark,
// not a flag decoration. Sits beside the wordmark.
function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={className}
      // Inline fill with CSS variable — doesn't depend on Tailwind generating
      // a text-neopop-red utility for this specific use.
      style={{ fill: 'var(--color-neopop-red)' }}
    >
      <path d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z" />
    </svg>
  )
}

// Standalone header for the /neopop prototype route.
// Deliberately NOT using the site-wide <Header /> since this page
// is showing an alternative visual language.
export function NeoPopHeader() {
  const navClass =
    'text-[16px] font-bold uppercase tracking-wide no-underline border-b-[3px] border-transparent hover:border-neopop-red focus-visible:outline-none focus-visible:bg-neopop-yellow focus-visible:text-neopop-black'

  return (
    <header className="bg-neopop-white border-b-[4px] border-neopop-black" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link
          href="/neopop"
          className="flex items-center gap-2 text-neopop-black font-black text-[22px] uppercase tracking-tight no-underline hover:text-neopop-red"
        >
          <MapleLeaf className="w-7 h-7" />
          AI This Week
        </Link>
        <nav aria-label="Prototype navigation">
          <ul className="flex gap-6 list-none m-0 p-0 items-center">
            <li>
              <Link href="/" className={`${navClass} text-neopop-black`}>
                ← Original site
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
