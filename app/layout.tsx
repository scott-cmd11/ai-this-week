import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ConditionalHeader, ConditionalFooter } from '@/components/ConditionalChrome'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai-this-week.vercel.app'

export const metadata: Metadata = {
  title: 'AI This Week',
  description: 'Weekly AI news from Canada and around the world, plus trending stories and research — in plain English.',
  alternates: {
    types: {
      'application/rss+xml': `${SITE_URL}/feed.xml`,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Runs before hydration to prevent flash of wrong theme */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ConditionalHeader />
        <main id="main-content" className="max-w-4xl mx-auto px-4 py-10" tabIndex={-1}>
          {children}
        </main>
        <ConditionalFooter />
      </body>
    </html>
  )
}
