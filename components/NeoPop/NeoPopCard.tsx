import Link from 'next/link'
import type { ReactNode } from 'react'
interface Props { href?: string; children: ReactNode; bg?: 'white' | 'yellow' | 'red' | 'cream' | 'accent-light' | 'accent' | 'page'; interactive?: boolean }
const bgClasses: Record<string, string> = { white: 'bg-ws-white', 'accent-light': 'bg-ws-accent-light', yellow: 'bg-ws-accent-light', accent: 'bg-ws-accent text-ws-white', red: 'bg-ws-accent text-ws-white', page: 'bg-ws-page', cream: 'bg-ws-page' }
export function NeoPopCard({ href, children, bg = 'white', interactive }: Props) {
  const isInteractive = interactive ?? Boolean(href)
  const className = ['block', 'border border-ws-border', 'rounded-lg', bgClasses[bg] || bgClasses.white, 'p-6', 'no-underline', 'transition-[border-color,box-shadow] duration-150 ease-out', isInteractive ? 'hover:border-ws-muted hover:shadow-sm active:shadow-none' : ''].join(' ')
  if (href) return <Link href={href} className={className}>{children}</Link>
  return <div className={className}>{children}</div>
}
