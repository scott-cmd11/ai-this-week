'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AddToIssue } from './_add-to-issue'
import { PublishedIssueEditor } from './_published-issue-editor'
import { SecondaryAdminTabs } from './_secondary-admin-tabs'
import { TonightIssueDesk } from './_tonight-issue-desk'
import type { TodayStatusPayload } from './_today-run-status'

type AdminMode = 'tonight' | 'issue-desk' | 'tools'

const MODES: Array<{ key: AdminMode; label: string }> = [
  { key: 'tonight', label: "Tonight's Issue" },
  { key: 'issue-desk', label: 'Issue Desk' },
  { key: 'tools', label: 'Tools' },
]

export function DailyRunShell({
  password,
  onSignOut,
}: {
  password: string
  onSignOut: () => void
}) {
  const [mode, setMode] = useState<AdminMode>('tonight')
  const [status, setStatus] = useState<TodayStatusPayload | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const statusRequestRef = useRef(0)

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const requestId = statusRequestRef.current + 1
    statusRequestRef.current = requestId
    const isActiveRequest = () => statusRequestRef.current === requestId && !signal?.aborted

    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/admin/today-status', {
        headers: { 'x-admin-password': password },
        signal,
      })
      if (res.status === 401) {
        if (isActiveRequest()) {
          setStatusError('Your admin session has expired. Sign out and sign back in.')
        }
        return
      }
      if (!res.ok) {
        if (isActiveRequest()) {
          setStatusError('Today status could not be loaded.')
        }
        return
      }
      const payload = (await res.json()) as TodayStatusPayload
      if (isActiveRequest()) {
        setStatus(payload)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (isActiveRequest()) {
        setStatusError('Today status could not be loaded.')
      }
    } finally {
      if (isActiveRequest()) {
        setStatusLoading(false)
      }
    }
  }, [password])

  useEffect(() => {
    const controller = new AbortController()
    void loadStatus(controller.signal)
    return () => controller.abort()
  }, [loadStatus])

  useEffect(() => {
    function refreshDraftStatus() {
      void loadStatus()
    }

    window.addEventListener('aitoday:refresh-draft', refreshDraftStatus)
    return () => window.removeEventListener('aitoday:refresh-draft', refreshDraftStatus)
  }, [loadStatus])

  return (
    <div className="admin-workspace min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-11">
      <div className="admin-shell flex flex-col gap-4">
        <header className="admin-panel p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="admin-eyebrow">Publisher console</p>
              <h1 className="admin-display-title mt-2">
                Publishing Desk
              </h1>
              <p className="admin-copy mt-3 max-w-3xl">
                Build tonight&apos;s issue, repair live issues, and check source tools without jumping through a technical wizard.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:self-center">
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="admin-button-secondary px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em]"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <nav className="admin-panel bg-ws-white p-1.5" aria-label="Admin publishing areas">
          <div className="admin-step-track grid grid-cols-1 gap-1 sm:grid-cols-3">
            {MODES.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={`whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-black uppercase tracking-[0.08em] transition-colors ${
                  mode === item.key ? 'bg-ws-accent text-white' : 'bg-transparent text-ws-black/65 hover:bg-ws-page hover:text-ws-black'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex flex-col gap-4">
          {statusLoading && (
            <PlaceholderSection
              title="Loading publishing desk"
              note="Checking candidates, source health, draft state, and publish readiness."
            />
          )}

          {statusError && (
            <section className="admin-panel border-red-200 bg-red-50 p-5 text-red-800">
              <p className="text-[13px] font-black uppercase tracking-[0.15em]">Status unavailable</p>
              <p className="mt-2 text-[15px] font-bold">{statusError}</p>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="mt-4 rounded-[0.55rem] bg-red-700 px-4 py-2 text-[12px] font-black uppercase tracking-[0.08em] text-white"
              >
                Try again
              </button>
            </section>
          )}

          {status && mode === 'tonight' && (
            <TonightIssueDesk
              password={password}
              status={status}
              statusRefreshing={statusLoading}
              onRefresh={() => void loadStatus()}
              onOpenIssueDesk={() => setMode('issue-desk')}
              onOpenTools={() => setMode('tools')}
            />
          )}

          {mode === 'issue-desk' && (
            <section className="admin-panel overflow-hidden bg-ws-white">
              <header className="border-b border-ws-border p-5 sm:p-6">
                <p className="admin-eyebrow">Published issue workflow</p>
                <h2 className="admin-page-title mt-2">
                  Issue Desk
                </h2>
                <p className="admin-copy mt-3 max-w-3xl">
                  Add, edit, remove, or correct articles in existing issues. Use this after publishing when the live issue needs one more source or a clean correction.
                </p>
              </header>
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <AddToIssue password={password} />
                <PublishedIssueEditor password={password} />
              </div>
            </section>
          )}

          {mode === 'tools' && <SecondaryAdminTabs password={password} />}
        </main>
      </div>
    </div>
  )
}

function PlaceholderSection({
  title,
  note,
}: {
  title: string
  note: string
}) {
  return (
    <section className="admin-panel border-dashed bg-ws-white p-6">
      <p className="admin-eyebrow">Working</p>
      <h2 className="admin-page-title mt-2">
        {title}
      </h2>
      <p className="admin-copy mt-3 max-w-2xl">{note}</p>
    </section>
  )
}
