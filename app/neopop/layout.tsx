import type { ReactNode } from 'react'
import { NeoPopHeader } from '@/components/NeoPop/NeoPopHeader'

// The root layout wraps children in <main class="max-w-4xl mx-auto px-4 py-10">.
// The "full-bleed" div below uses viewport-width to escape that container so the
// cream background can span the full screen, then re-centers its content inside.
// Reference: https://css-tricks.com/full-width-containers-limited-width-parents/
export default function NeoPopLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="bg-neopop-cream text-neopop-black"
      style={{
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: '-2.5rem',
        marginBottom: '-2.5rem',
        paddingBottom: '4rem',
        width: '100vw',
        minHeight: 'calc(100vh)',
      }}
    >
      <NeoPopHeader />
      <div className="max-w-4xl mx-auto px-4 py-10">{children}</div>
    </div>
  )
}
