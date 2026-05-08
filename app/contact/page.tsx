import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with AI Today - questions, corrections, story tips.',
  alternates: {
    canonical: '/contact',
  },
}

export default function ContactPage() {
  return (
    <>
      <p className="type-kicker mb-5">Contact</p>
      <h1 className="type-page-title mb-4">
        Contact
      </h1>
      <div className="section-rule mb-8" aria-hidden="true" />

      <p className="type-lede mb-10 max-w-xl">
        Questions, corrections, or a story to pass along? Send a message and I&apos;ll
        reply when I can.
      </p>

      <ContactForm />
    </>
  )
}
