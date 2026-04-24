'use client'

import { useState } from 'react'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // Hidden honeypot — intentionally named like a real field ("website") so
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
      <div className="border-[3px] border-neopop-black bg-neopop-yellow p-6 shadow-[6px_6px_0_0_var(--color-neopop-black)]">
        <p className="text-[13px] font-black uppercase tracking-[0.15em] mb-2">✓ Message sent</p>
        <p className="text-[19px] leading-[1.5]">
          Thanks for reaching out. I&apos;ll get back to you as soon as I can.
        </p>
      </div>
    )
  }

  const isSending = state === 'sending'
  const labelClass = 'text-[13px] font-black uppercase tracking-wide'
  const inputClass =
    'border-[3px] border-neopop-black px-3 py-3 text-[17px] bg-neopop-white w-full focus-visible:outline-none focus-visible:border-neopop-red disabled:bg-neopop-cream disabled:cursor-not-allowed'

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 max-w-xl">
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
        <p className="text-[12px] text-ws-black/70">{message.length} / 5000</p>
      </div>

      {/* Honeypot — hidden from users, label warns bots who read it anyway. */}
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
        <div className="border-[3px] border-neopop-red bg-neopop-white px-4 py-3 shadow-[4px_4px_0_0_var(--color-neopop-red)]" role="alert">
          <p className="text-[14px] font-black uppercase tracking-wide text-ws-accent">Error</p>
          <p className="text-[15px] text-ws-black">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSending}
        className="border-[3px] border-neopop-black bg-ws-accent text-ws-white font-black uppercase tracking-wide text-[17px] px-6 py-3 self-start shadow-[6px_6px_0_0_var(--color-neopop-black)] transition-[transform,box-shadow] duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_var(--color-neopop-black)] hover:bg-neopop-red-dark active:translate-x-[4px] active:translate-y-[4px] active:shadow-[2px_2px_0_0_var(--color-neopop-black)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSending ? 'Sending…' : '✦ Send message'}
      </button>
    </form>
  )
}
