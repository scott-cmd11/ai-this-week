import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-t-[4px] border-neopop-black mt-16 py-8 bg-neopop-white"
      role="contentinfo"
    >
      <div className="max-w-4xl mx-auto px-4 flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[15px] text-neopop-black max-w-xl">
          <span className="font-black uppercase tracking-wide">AI disclosure —</span>{' '}
          All summaries are AI-generated. Review official sources. Minor editing happens prior to publishing.{' '}
          <Link
            href="/about"
            className="underline font-bold hover:text-neopop-red hover:no-underline"
          >
            Learn more
          </Link>
          {' · '}
          <a
            href="mailto:scott.hazlitt@gmail.com"
            className="underline font-bold hover:text-neopop-red hover:no-underline"
          >
            Contact
          </a>
        </p>
        <p className="text-[13px] text-neopop-black font-bold uppercase tracking-wider">
          Made in Canada
        </p>
      </div>
    </footer>
  )
}
