import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-t-4 border-govuk-blue mt-16 py-8 bg-govuk-light-grey dark:bg-govuk-black"
      role="contentinfo"
    >
      <div className="max-w-4xl mx-auto px-4">
        <p className="text-[16px] text-govuk-dark-grey">
          Summaries on this site are drafted with AI assistance and reviewed before
          publication.{' '}
          <Link href="/about" className="text-govuk-blue underline hover:no-underline">
            Learn more
          </Link>
        </p>
      </div>
    </footer>
  )
}
