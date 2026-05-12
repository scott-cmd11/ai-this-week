import Link from 'next/link'

const SOCIAL_LINKS = [
  {
    label: 'Website',
    href: 'https://scotthazlitt.ai',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/scott-hazlitt/',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/scott-cmd11',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ws-border bg-ws-black text-ws-white" role="contentinfo">
      <div className="mx-auto flex w-[min(100%-2rem,1180px)] flex-col gap-7 py-10 sm:py-12">
        <div className="grid gap-6 border-b border-white/12 pb-7 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)] lg:items-start">
          <div>
            <p className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-none sm:text-[34px]">
              AI Today
            </p>
            <p className="type-meta type-muted-inverse mt-3 opacity-70">
              Canadian AI signal, daily
            </p>
          </div>

          <div className="max-w-3xl lg:justify-self-end">
            <p className="type-meta type-muted-inverse opacity-70">Editorial standard</p>
            <p className="mt-2 text-[16px] leading-[1.6] text-white/78">
              <span className="font-semibold text-white">AI disclosure:</span>{' '}
              All summaries are AI-generated. Review official sources. Minor editing happens prior to publishing.
            </p>
            <nav aria-label="Footer editorial links" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/about" className="text-[14px] font-semibold text-ws-accent-light underline hover:text-ws-white hover:no-underline">
                Learn more
              </Link>
              <Link href="/contact" className="text-[14px] font-semibold text-ws-accent-light underline hover:text-ws-white hover:no-underline">
                Contact
              </Link>
            </nav>
          </div>
        </div>

        <div className="grid gap-3 border-b border-white/12 pb-7 lg:grid-cols-[minmax(180px,0.35fr)_minmax(0,1fr)]">
          <p className="type-meta type-muted-inverse opacity-70">Companion project</p>
          <p className="max-w-4xl text-[15px] leading-[1.65] text-white/74">
            For a deeper view of Canadian AI adoption, policy, infrastructure, and public-sector signals, visit{' '}
            <a
              href="https://www.aicanadapulse.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ws-accent-light underline hover:text-ws-white hover:no-underline"
            >
              AI Canada Pulse
            </a>
            , a companion project tracking how AI is showing up across Canada.
          </p>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-white/68">
            A project by{' '}
            <a
              href="https://scotthazlitt.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ws-accent-light underline hover:text-ws-white hover:no-underline"
            >
              Scott Hazlitt
            </a>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {SOCIAL_LINKS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/12 text-white/58 transition-colors hover:border-ws-accent-light/45 hover:text-ws-accent-light"
              >
                {icon}
              </a>
            ))}
            <p className="type-button type-muted-inverse text-[13px] opacity-78">Made in Canada</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
