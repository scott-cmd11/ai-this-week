import type { Metadata } from 'next'
import { ContactForm } from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact | AI This Week',
  description: 'Get in touch with AI This Week — questions, corrections, story tips.',
}

export default function ContactPage() {
  return (
    <>
      <h1 className="text-[36px] sm:text-[48px] lg:text-[56px] font-black uppercase leading-[0.95] tracking-tight mb-4">
        Contact
      </h1>
      <div className="w-20 h-[6px] bg-neopop-red mb-8" aria-hidden="true" />

      <p className="text-[19px] leading-[1.5] mb-10 max-w-xl">
        Questions, corrections, or a story to pass along? Send a message and I&apos;ll
        reply when I can.
      </p>

      <ContactForm />
    </>
  )
}
