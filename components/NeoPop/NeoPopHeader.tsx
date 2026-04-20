import Link from 'next/link'

// Standalone header for the /neopop prototype route.
// Deliberately NOT using the site-wide <Header /> since this page
// is showing an alternative visual language.
export function NeoPopHeader() {
  const navClass =
    'text-[16px] font-bold uppercase tracking-wide no-underline border-b-[3px] border-transparent hover:border-neopop-yellow focus-visible:outline-none focus-visible:bg-neopop-yellow focus-visible:text-neopop-black'

  return (
    <header className="bg-neopop-white border-b-[4px] border-neopop-black" role="banner">
      <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
        <Link
          href="/neopop"
          className="text-neopop-black font-black text-[22px] uppercase tracking-tight no-underline hover:text-neopop-blue"
        >
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
