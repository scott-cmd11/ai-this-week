import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-2xl">
      <p className="text-[16px] font-bold text-govuk-dark-grey uppercase tracking-wide mb-3">
        Error 404
      </p>
      <h1 className="text-[48px] font-bold text-govuk-black leading-tight mb-4">
        Page not found
      </h1>
      <p className="text-[19px] text-govuk-black leading-[1.5] mb-8">
        The page you&apos;re looking for doesn&apos;t exist. The link might be broken, or
        the issue might have been moved.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-block bg-govuk-black text-white dark:bg-white dark:text-govuk-black font-bold text-[17px] px-5 py-3 hover:bg-govuk-dark-grey no-underline"
        >
          Back to the latest issue
        </Link>
        <Link
          href="/issues"
          className="inline-block border-2 border-govuk-black dark:border-govuk-mid-grey text-govuk-black font-bold text-[17px] px-5 py-3 hover:bg-govuk-light-grey no-underline"
        >
          Browse all issues
        </Link>
      </div>
    </div>
  )
}
