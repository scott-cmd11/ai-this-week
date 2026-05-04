import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  href?: string
  children: ReactNode
  bg?: 'white' | 'yellow' | 'red' | 'cream' | 'accent-light' | 'accent' | 'page'
  interactive?: boolean
}

const bgClasses: Record<string, string> = {
  white: 'bg-ws-white',
  'accent-light': 'bg-ws-accent-light',
  yellow: 'bg-amber-50 border-l-4 border-ws-accent',
  accent: 'bg-ws-accent text-ws-white',
  red: 'bg-ws-accent text-ws-white',
  page: 'bg-ws-page',
  cream: 'bg-ws-page',
}

export function NeoPopCard({ href, children, bg = 'white', interactive }: Props) {
  const isInteractive = interactive ?? Boolean(href)

  const className = [
    'block',
    bg !== 'yellow' && 'border border-ws-border',
    'rounded-[0.65rem]',
    bgClasses[bg] || bgClasses.white,
    'p-6',
    'no-underline',
    'shadow-[0_18px_48px_rgba(20,17,15,0.07)]',
    'transition-[transform,border-color,box-shadow] duration-150 ease-out',
    isInteractive && 'hover:-translate-y-0.5 hover:border-ws-accent/35 hover:shadow-[0_24px_64px_rgba(20,17,15,0.10)]',
    isInteractive && 'focus-visible:outline-2 focus-visible:outline-ws-accent focus-visible:outline-offset-2',
  ].filter(Boolean).join(' ')

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  return <div className={className}>{children}</div>
}
