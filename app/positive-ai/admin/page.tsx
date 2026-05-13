'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { GoodNewsStory } from '@/lib/good-news-types'

type AdminTab = 'pending' | 'published'

interface StoryResponse {
  configured: boolean
  stories: GoodNewsStory[]
  setup?: string
  error?: string
}

export default function GoodNewsAdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<AdminTab>('pending')
  const [stories, setStories] = useState<GoodNewsStory[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')

  const pendingCount = useMemo(() => stories.filter(story => story.status !== 'published').length, [stories])

  useEffect(() => {
    document.title = authed ? 'AI Good News admin - AI Today' : 'AI Good News sign in - AI Today'
  }, [authed])

  async function loadStories(nextPassword = password, nextTab = tab) {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/positive-ai/stories?status=${nextTab === 'pending' ? 'pending,approved' : 'published'}`, {
        headers: { 'x-admin-password': nextPassword },
      })
      const data = await res.json() as StoryResponse
      if (!res.ok) {
        setMessage(data.error ?? 'Could not load AI Good News stories.')
        setAuthed(false)
        return
      }
      setStories(data.stories)
      setAuthed(true)
      setMessage(data.configured ? '' : data.setup ?? 'Using local seed data until Supabase tables are configured.')
    } finally {
      setLoading(false)
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    await loadStories(password, tab)
  }

  async function updateStory(id: string, patch: Partial<GoodNewsStory>) {
    setLoading(true)
    try {
      const res = await fetch(`/api/positive-ai/stories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ patch }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Update failed.')
        return
      }
      await loadStories(password, tab)
    } finally {
      setLoading(false)
    }
  }

  async function addManualStory(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/positive-ai/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({ url: manualUrl, title: manualTitle }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Manual add failed.')
        return
      }
      setManualUrl('')
      setManualTitle('')
      setMessage('Manual story added to pending review.')
      await loadStories(password, 'pending')
      setTab('pending')
    } finally {
      setLoading(false)
    }
  }

  async function triggerAction(path: string, success: string) {
    setLoading(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Action failed.')
        return
      }
      setMessage(success)
      await loadStories(password, tab)
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="admin-workspace grid min-h-[60vh] place-items-center px-1 py-6">
        <div className="w-full max-w-md">
          <p className="admin-eyebrow mb-3">AI Good News</p>
          <h1 className="admin-display-title mb-4">Review desk</h1>
          <p className="admin-copy mb-6">
            Sign in with the AI Good News review password.
          </p>
          <form onSubmit={signIn} className="admin-panel grid gap-4 p-5">
            <label className="admin-field-label" htmlFor="good-news-password">Password</label>
            <input
              id="good-news-password"
              type="password"
              className="admin-input px-3 py-3"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
            {message && <p className="admin-notice p-3" role="alert">{message}</p>}
            <button type="submit" disabled={loading || !password} className="admin-button-primary justify-self-start px-4 py-2 font-semibold disabled:opacity-50">
              {loading ? 'Checking...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-workspace admin-shell">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-t border-ws-black pt-6">
        <div>
          <p className="admin-eyebrow">AI Good News</p>
          <h1 className="admin-display-title mt-2">Review desk</h1>
          <p className="admin-copy mt-3 max-w-2xl">
            Approve useful stories, reject weak ones, add manual URLs, and regenerate the daily digest.
          </p>
        </div>
        <button className="admin-button-secondary px-4 py-2 font-semibold" onClick={() => setAuthed(false)}>
          Sign out
        </button>
      </div>

      {message && <p className="admin-notice mb-5 p-3" role="status">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="admin-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="admin-segmented flex">
              {(['pending', 'published'] as const).map(nextTab => (
                <button
                  key={nextTab}
                  type="button"
                  onClick={() => {
                    setTab(nextTab)
                    void loadStories(password, nextTab)
                  }}
                  className={[
                    'px-3 py-2 text-sm font-bold capitalize',
                    tab === nextTab ? 'admin-button-primary' : 'admin-button-ghost',
                  ].join(' ')}
                >
                  {nextTab}
                </button>
              ))}
            </div>
            <span className="admin-eyebrow">{pendingCount} in review</span>
          </div>

          <div className="grid gap-3">
            {stories.map(story => (
              <article key={story.id} className="admin-subpanel p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="admin-eyebrow">{story.category} / {story.source_name}</p>
                    <h2 className="mt-2 font-[family-name:var(--font-display)] text-[1.6rem] font-bold leading-tight text-ws-black">
                      {story.title}
                    </h2>
                    <p className="admin-copy mt-2">{story.summary}</p>
                    <p className="mt-3 text-sm font-semibold text-ws-muted">
                      Credibility {story.credibility_score} / Positivity {story.positivity_score}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {story.status !== 'published' && (
                      <>
                        <button className="admin-button-primary px-3 py-2 text-sm font-bold" disabled={loading} onClick={() => updateStory(story.id, { status: 'published' })}>
                          Publish
                        </button>
                        <button className="admin-button-secondary px-3 py-2 text-sm font-bold" disabled={loading} onClick={() => updateStory(story.id, { status: 'approved' })}>
                          Approve
                        </button>
                        <button className="admin-button-secondary px-3 py-2 text-sm font-bold" disabled={loading} onClick={() => updateStory(story.id, { status: 'rejected' })}>
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      className="admin-button-secondary px-3 py-2 text-sm font-bold"
                      disabled={loading}
                      onClick={() => {
                        const next = window.prompt('Edit summary', story.summary)
                        if (next !== null) void updateStory(story.id, { summary: next })
                      }}
                    >
                      Edit summary
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-5">
          <section className="admin-panel p-5">
            <p className="admin-eyebrow">Manual add</p>
            <form onSubmit={addManualStory} className="mt-4 grid gap-3">
              <label className="admin-field-label" htmlFor="manual-title">Title</label>
              <input id="manual-title" className="admin-input px-3 py-2" value={manualTitle} onChange={event => setManualTitle(event.target.value)} required />
              <label className="admin-field-label" htmlFor="manual-url">Source URL</label>
              <input id="manual-url" className="admin-input px-3 py-2" value={manualUrl} onChange={event => setManualUrl(event.target.value)} required />
              <button type="submit" disabled={loading} className="admin-button-primary px-4 py-2 font-semibold disabled:opacity-50">
                Add to pending
              </button>
            </form>
          </section>

          <section className="admin-panel p-5">
            <p className="admin-eyebrow">Automation</p>
            <div className="mt-4 grid gap-3">
              <button className="admin-button-secondary px-4 py-2 font-semibold" disabled={loading} onClick={() => triggerAction('/api/positive-ai/ingest', 'Ingestion finished. Check pending stories.')}>
                Trigger ingestion
              </button>
              <button className="admin-button-secondary px-4 py-2 font-semibold" disabled={loading} onClick={() => triggerAction('/api/positive-ai/digest', 'Daily digest generated.')}>
                Generate digest
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
