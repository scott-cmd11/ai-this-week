import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Capture',
  alternates: {
    canonical: '/capture',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
