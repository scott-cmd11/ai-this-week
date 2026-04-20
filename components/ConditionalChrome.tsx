'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

// Wraps Header and Footer. Hides both on /neopop routes so the
// prototype can render its own NeoPop-styled header/footer.
// If the user approves the NeoPop direction, this wrapper goes away
// and the default chrome is rebuilt in NeoPop style.
export function ConditionalHeader() {
  const pathname = usePathname()
  if (pathname?.startsWith('/neopop')) return null
  return <Header />
}

export function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname?.startsWith('/neopop')) return null
  return <Footer />
}
