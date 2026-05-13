import Link from 'next/link'

function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={className}
      style={{ fill: '#B54818' }}
    >
      <path d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z" />
    </svg>
  )
}

export function Header() {
  const navLinkClass =
    'type-button text-ws-muted no-underline transition-colors hover:text-ws-black focus-visible:outline-none focus-visible:bg-[var(--color-focus)] focus-visible:text-ws-white focus-visible:px-1'

  return (
    <header className="sticky top-0 z-50 border-b border-ws-border bg-ws-page/92 backdrop-blur-xl" role="banner">
      <div className="mx-auto flex w-[min(100%-2rem,1180px)] items-center justify-between gap-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-[23px] font-semibold leading-none tracking-normal text-ws-black no-underline transition-colors hover:text-ws-accent focus-visible:bg-[var(--color-focus)] focus-visible:px-1 focus-visible:text-ws-white focus-visible:outline-none"
        >
          <MapleLeaf className="h-5 w-5" />
          <span>AI Today</span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex gap-4 sm:gap-6 list-none m-0 p-0">
            <li><Link href="/positive-ai" className={navLinkClass}>AI Good News</Link></li>
            <li><Link href="/issues" className={navLinkClass}>Issues</Link></li>
            <li><Link href="/about" className={navLinkClass}>About</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
