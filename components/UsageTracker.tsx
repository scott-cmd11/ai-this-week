'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics/react'

type PageKind = 'home' | 'issue' | 'archive' | 'about' | 'contact' | 'section' | 'capture' | 'admin' | 'other'

interface PageContext {
  kind: PageKind
  issueDate?: string
  section?: string
}

function pageContext(pathname: string): PageContext {
  if (pathname === '/') return { kind: 'home' }
  if (pathname === '/issues') return { kind: 'archive' }
  if (pathname === '/about') return { kind: 'about' }
  if (pathname === '/contact') return { kind: 'contact' }
  if (pathname === '/capture') return { kind: 'capture' }
  if (pathname === '/admin') return { kind: 'admin' }

  const issueMatch = pathname.match(/^\/issues\/(\d{4}-\d{2}-\d{2})$/)
  if (issueMatch) return { kind: 'issue', issueDate: issueMatch[1] }

  const sectionMatch = pathname.match(/^\/sections\/([^/]+)$/)
  if (pathname === '/sections') return { kind: 'section', section: 'index' }
  if (sectionMatch) return { kind: 'section', section: sectionMatch[1] }

  return { kind: 'other' }
}

function isExternalUrl(href: string): boolean {
  try {
    return new URL(href, window.location.origin).origin !== window.location.origin
  } catch {
    return false
  }
}

function hostFromHref(href: string): string {
  try {
    return new URL(href, window.location.origin).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

function outboundKind(host: string): string {
  if (host.includes('aicanadapulse.ca')) return 'companion-project'
  if (host.includes('scotthazlitt.ai')) return 'creator-site'
  if (host.includes('linkedin.com') || host.includes('github.com')) return 'profile'
  return 'source'
}

export function UsageTracker() {
  const pathname = usePathname()

  useEffect(() => {
    const context = pageContext(pathname)
    if (context.kind === 'admin') return

    track('Public page viewed', {
      page: context.kind,
      issueDate: context.issueDate,
      section: context.section,
    })
  }, [pathname])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest('a[href]')
        : null
      if (!(target instanceof HTMLAnchorElement)) return

      const href = target.getAttribute('href')
      if (!href) return

      const context = pageContext(window.location.pathname)
      if (context.kind === 'admin') return

      if (isExternalUrl(href)) {
        const host = hostFromHref(href)
        track('Outbound link clicked', {
          page: context.kind,
          host,
          target: outboundKind(host),
          issueDate: context.issueDate,
          section: context.section,
        })
        return
      }

      const nextUrl = new URL(href, window.location.origin)
      const nextContext = pageContext(nextUrl.pathname)
      if (nextContext.kind === 'issue') {
        track('Issue link clicked', {
          fromPage: context.kind,
          issueDate: nextContext.issueDate,
        })
      }
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [])

  return null
}
