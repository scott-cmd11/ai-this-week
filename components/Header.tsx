import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-govuk-black" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-white font-bold text-[19px] no-underline hover:underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
        >
          AI This Week
        </Link>
        <nav aria-label="Main navigation">
          {/* Focus override: yellow-bg replaces global ring — black bottom-bar is invisible on dark header */}
          <ul className="flex gap-6 list-none m-0 p-0">
            <li>
              <Link
                href="/issues"
                className="text-white text-[16px] underline hover:no-underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
              >
                Issues
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-white text-[16px] underline hover:no-underline focus-visible:outline-none focus-visible:bg-govuk-yellow focus-visible:text-govuk-black focus-visible:px-1"
              >
                About
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
