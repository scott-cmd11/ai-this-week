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
    bg === 'yellow' ? '' : 'border border-ws-border',
    'rounded-sm',
    bgClasses[bg] || bgClasses.white,
    'p-6',
    'no-underline',
    'shadow-[0_2px_8px_rgba(28,25,23,0.07)]',
    'transition-[border-color,box-shadow] duration-150 ease-out',
    isInteractive
      ? 'hover:shadow-[0_4px_16px_rgba(28,25,23,0.10)]'
      : '',
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  return <div className={className}>{children}</div>
}
