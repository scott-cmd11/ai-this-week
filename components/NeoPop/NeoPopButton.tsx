import Link from 'next/link'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary'

interface Props {
  href: string
  children: ReactNode
  variant?: Variant
  external?: boolean
}

// NeoPop button: thick border, hard-offset shadow, press-down on hover/active.
// The 3D illusion comes from translating the element toward the shadow
// and shrinking the shadow by the same amount — it looks like the button
// is physically being pushed into the page.
const baseClasses = [
  'inline-block',
  'border-[3px] border-neopop-black',
  'font-black uppercase tracking-wide',
  'text-[17px] px-6 py-3',
  'no-underline',
  'transition-[transform,box-shadow] duration-100 ease-out',
  'shadow-[6px_6px_0_0_var(--color-neopop-black)]',
  'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-neopop-black)]',
  'active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-neopop-black)]',
  'focus-visible:outline-none',
].join(' ')

const variantClasses: Record<Variant, string> = {
  primary: 'bg-neopop-blue text-neopop-white',
  secondary: 'bg-neopop-yellow text-neopop-black',
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
