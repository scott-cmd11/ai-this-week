import Link from 'next/link'

function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={className}
      style={{ fill: '#B71C1C' }}
    >
      <path d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z" />
    </svg>
  )
}

export function Header() {
  const navLinkClass =
    'text-ws-black text-[15px] font-semibold tracking-wide no-underline border-b-[2px] border-transparent hover:border-ws-accent focus-visible:outline-none focus-visible:bg-[var(--color-focus)] focus-visible:text-ws-black focus-visible:px-1'

  return (
    <header className="bg-ws-white border-b border-ws-border" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-ws-black font-bold text-[20px] sm:text-[22px] tracking-tight no-underline hover:text-ws-accent focus-visible:outline-none focus-visible:bg-[var(--color-focus)] focus-visible:px-1"
        >
          <MapleLeaf className="w-6 h-6 sm:w-7 sm:h-7" />
          AI This Week
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex gap-5 sm:gap-7 list-none m-0 p-0">
            <li><Link href="/issues" className={navLinkClass}>Issues</Link></li>
            <li><Link href="/sections" className={navLinkClass}>Sections</Link></li>
            <li><Link href="/about" className={navLinkClass}>About</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
