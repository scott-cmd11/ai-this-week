import Link from 'next/link'
export function Footer() {
  return (
    <footer className="border-t border-ws-border mt-16 py-8 bg-ws-white" role="contentinfo">
      <div className="max-w-4xl mx-auto px-4 flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[15px] text-ws-muted max-w-xl">
          <span className="font-semibold">AI disclosure —</span>{' '}All summaries are AI-generated. Review official sources. Minor editing happens prior to publishing.{' '}
          <Link href="/about" className="underline font-semibold text-ws-accent hover:text-ws-accent-hover hover:no-underline">Learn more</Link>
          {' · '}<Link href="/contact" className="underline font-semibold text-ws-accent hover:text-ws-accent-hover hover:no-underline">Contact</Link>
        </p>
        <p className="text-[13px] text-ws-muted font-semibold tracking-wider">Made in Canada</p>
      </div>
    </footer>
  )
}
