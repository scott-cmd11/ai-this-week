import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-2xl">
      <p className="type-kicker mb-5">
        Error 404
      </p>
      <h1 className="type-page-title mb-4">
        Page not found
      </h1>
      <div className="section-rule mb-6" aria-hidden="true" />
      <p className="type-lede mb-8">
        The page you&apos;re looking for doesn&apos;t exist. The link might be broken, or
        the issue might have been moved.
      </p>

      <div className="flex flex-wrap gap-4">
        <Link href="/" className="type-button inline-flex min-h-11 items-center rounded-full bg-ws-accent px-5 py-3 text-ws-white no-underline shadow-[0_12px_28px_rgba(223,72,36,0.24)] transition-colors hover:bg-ws-accent-hover focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2">
          Back to latest issue
        </Link>
        <Link href="/issues" className="type-button inline-flex min-h-11 items-center rounded-full border border-ws-border bg-ws-page px-5 py-3 text-ws-black no-underline transition-colors hover:border-ws-muted hover:bg-ws-white focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2">
          Browse all issues
        </Link>
      </div>
    </div>
  )
}
