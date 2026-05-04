'use client'

import { useState } from 'react'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // Hidden honeypot intentionally named like a real field ("website") so
  // spam bots fill it. Real users never see it, never fill it.
  const [website, setWebsite] = useState('')

  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error ?? `Something went wrong (HTTP ${res.status}).`)
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setErrorMessage('Network error. Please try again in a moment.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-[0.75rem] border border-ws-border bg-ws-accent-light p-6 shadow-[0_18px_48px_rgba(20,17,15,0.07)]">
        <p className="type-meta mb-2 text-ws-accent">Message sent</p>
        <p className="type-body text-[18px]">
          Thanks for reaching out. I&apos;ll get back to you as soon as I can.
        </p>
      </div>
    )
  }

  const isSending = state === 'sending'
  const labelClass = 'type-meta normal-case tracking-[0.02em]'
  const inputClass =
    'w-full rounded-[0.55rem] border border-ws-border bg-ws-white px-3 py-3 text-[17px] disabled:cursor-not-allowed disabled:bg-ws-page focus-visible:border-ws-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ws-accent/15'

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="contact-name" className={labelClass}>Name</label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isSending}
          required
          maxLength={120}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contact-email" className={labelClass}>Email</label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isSending}
          required
          maxLength={200}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="contact-message" className={labelClass}>Message</label>
        <textarea
          id="contact-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={isSending}
          required
          maxLength={5000}
          rows={8}
          className={`${inputClass} resize-y font-sans leading-[1.5]`}
        />
        <p className="type-body text-[12px]">{message.length} / 5000</p>
      </div>

      {/* Honeypot hidden from users; label warns bots who read it anyway. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="contact-website">Website (leave blank)</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={e => setWebsite(e.target.value)}
        />
      </div>

      {errorMessage && (
        <div className="rounded-[0.65rem] border border-ws-accent/35 bg-ws-white px-4 py-3 shadow-[0_14px_36px_rgba(223,72,36,0.10)]" role="alert">
          <p className="type-meta text-ws-accent">Error</p>
          <p className="type-body text-[15px] text-ws-black">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSending}
        className="self-start rounded-full bg-ws-accent px-6 py-3 text-[16px] font-semibold tracking-wide text-ws-white shadow-[0_12px_28px_rgba(223,72,36,0.24)] transition-colors hover:bg-ws-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ws-accent"
      >
        {isSending ? 'Sending...' : 'Send message'}
      </button>
    </form>
  )
}
