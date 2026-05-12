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
      <section className="border-t border-ws-black pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <h1 className="type-page-title mb-4">
              Corrections, tips, and source notes.
            </h1>
            <p className="type-lede max-w-2xl">
              Send a correction, source suggestion, or Canadian AI signal worth reviewing for a future issue.
              The best notes point to primary sources, public records, or clearly dated announcements.
            </p>
          </div>

          <aside className="border-y border-ws-border py-4" aria-label="Contact standard">
            <p className="type-meta text-ws-accent">Source standard</p>
            <dl className="mt-4 grid gap-0 divide-y divide-ws-border border-y border-ws-border">
              <div className="py-3">
                <dt className="type-meta text-ws-muted">Useful tips</dt>
                <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                  Link to the original source.
                </dd>
              </div>
              <div className="py-3">
                <dt className="type-meta text-ws-muted">Corrections</dt>
                <dd className="mt-1 text-[15px] font-semibold leading-snug text-ws-black">
                  Include the issue date and story title.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <div className="section-rule my-10" aria-hidden="true" />

      <ContactForm />
    </>
  )
}
