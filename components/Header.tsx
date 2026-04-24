import Link from 'next/link'

// Simplified 11-point maple leaf in Canada red. Kept restrained —
// the goal is a small national mark, not a flag decoration.
function MapleLeaf({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 512 512"
      className={className}
      // Inline fill with CSS variable — doesn't depend on Tailwind
      // generating a text-neopop-red utility for this use.
      style={{ fill: 'var(--color-neopop-red)' }}
    >
      <path d="M256 28l-30 56-30-18 12 90-68-12 24 58-42 18 78 74-14 36 80-14v106h20V316l80 14-14-36 78-74-42-18 24-58-68 12 12-90-30 18z" />
    </svg>
  )
}

export function Header() {
  const navLinkClass =
    'text-neopop-black text-[15px] font-black uppercase tracking-wide no-underline border-b-[3px] border-transparent hover:border-neopop-red focus-visible:outline-none focus-visible:bg-neopop-yellow focus-visible:text-neopop-black focus-visible:px-1'

  return (
    <header className="bg-neopop-white border-b-[4px] border-neopop-black" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-3 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-neopop-black font-black text-[20px] sm:text-[22px] uppercase tracking-tight no-underline hover:text-neopop-red focus-visible:outline-none focus-visible:bg-neopop-yellow focus-visible:px-1"
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
