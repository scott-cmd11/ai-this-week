import Link from 'next/link'
import type { ReactNode } from 'react'

interface Props {
  href?: string
  children: ReactNode
  bg?: 'white' | 'yellow' | 'red' | 'cream'
  /** When true, shrinks the shadow on hover for a press-down feel. Default true when href is set. */
  interactive?: boolean
}

const bgClasses = {
  white: 'bg-neopop-white',
  yellow: 'bg-neopop-yellow',
  red: 'bg-neopop-red text-neopop-white',
  cream: 'bg-neopop-cream',
} as const

// NeoPop card: thick black border, hard 8px offset shadow, no blur.
// When interactive (has href), hover presses the card 2px toward the shadow
// and reduces the shadow to 6px — matches NeoPopButton's motion vocabulary.
export function NeoPopCard({ href, children, bg = 'white', interactive }: Props) {
  const isInteractive = interactive ?? Boolean(href)

  const className = [
    'block',
    'border-[3px] border-neopop-black',
    bgClasses[bg],
    'p-6',
    'no-underline',
    'shadow-[8px_8px_0_0_var(--color-neopop-black)]',
    'transition-[transform,box-shadow] duration-100 ease-out',
    isInteractive
      ? 'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0_0_var(--color-neopop-black)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-[4px_4px_0_0_var(--color-neopop-black)]'
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
