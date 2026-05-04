import Link from 'next/link'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props {
  href: string
  children: ReactNode
  variant?: Variant
  external?: boolean
}

const baseClasses = [
  'inline-block',
  'font-semibold tracking-wide',
  'text-[16px] px-5 py-2.5',
  'rounded-md',
  'no-underline',
  'transition-colors duration-150 ease-out',
  'focus-visible:outline-none',
].join(' ')

const variantClasses: Record<Variant, string> = {
  primary: 'bg-ws-accent text-ws-white hover:bg-ws-accent-hover shadow-[0_10px_24px_rgba(200,88,18,0.24)]',
  secondary: 'bg-ws-page text-ws-black border border-ws-border hover:border-ws-muted hover:bg-ws-white',
  ghost: 'bg-ws-white/10 text-ws-white border border-white/24 hover:bg-ws-white/18',
}

export function NeoPopButton({ href, children, variant = 'primary', external = false }: Props) {
  const className = `${baseClasses} ${variantClasses[variant]}`

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
