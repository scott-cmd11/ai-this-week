'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DailyRunShell } from './_daily-run-shell'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = authed ? 'Admin - AI Today' : 'Admin sign in - AI Today'
  }, [authed])

  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth')
    if (!stored) {
      passwordRef.current?.focus()
      return
    }

    fetch('/api/admin/today-status', { headers: { 'x-admin-password': stored } })
      .then(res => {
        if (res.ok) {
          setPassword(stored)
          setAuthed(true)
          return
        }
        sessionStorage.removeItem('adminAuth')
        passwordRef.current?.focus()
      })
      .catch(() => {
        passwordRef.current?.focus()
      })
  }, [])

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)

    try {
      const res = await fetch('/api/admin/today-status', { headers: { 'x-admin-password': password } })
      if (res.status === 401) {
        setAuthError('Incorrect password.')
        return
      }
      if (!res.ok) {
        setAuthError('Server error. Try again.')
        return
      }
      sessionStorage.setItem('adminAuth', password)
      setAuthed(true)
    } catch {
      setAuthError('Could not reach the server. Try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    if (!window.confirm('Sign out?')) return
    sessionStorage.removeItem('adminAuth')
    setPassword('')
    setAuthed(false)
    setAuthError('')
    passwordRef.current?.focus()
  }

  if (authed) {
    return <DailyRunShell password={password} onSignOut={handleSignOut} />
  }

  return (
    <div className="admin-workspace grid min-h-[60vh] place-items-center px-1 py-6">
      <div className="w-full max-w-md">
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-[42px] font-black leading-[0.95] tracking-tight sm:text-[56px]">
          Admin sign in
        </h1>
        <p className="mb-8 text-[16px] leading-[1.55] text-ws-muted">
          Import sources, assemble the issue, and publish the daily brief from one focused console.
        </p>
        <div className="glass-panel rounded-[0.8rem] p-4 sm:p-6">
          <form onSubmit={handleSignIn} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[13px] font-black uppercase tracking-wide">
                Password
              </label>
              <input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={authLoading}
                required
                className="w-full rounded-sm border border-ws-border px-3 py-3 font-mono text-[17px] transition-colors focus-visible:border-ws-accent focus-visible:outline-none disabled:bg-ws-page"
              />
              {authError && (
                <p className="text-[14px] font-bold text-ws-accent" role="alert">{authError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={authLoading || !password}
              className="self-start rounded-sm bg-ws-accent px-5 py-2.5 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-ws-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
