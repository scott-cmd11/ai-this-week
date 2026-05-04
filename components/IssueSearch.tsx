'use client'

import { useId, useState } from 'react'
import type { Issue } from '@/lib/types'
import { IssueCard } from './IssueCard'

interface Props {
  issues: Issue[]
}

export function IssueSearch({ issues }: Props) {
  const [query, setQuery] = useState('')
  const inputId = useId()

  const filtered = query.trim()
    ? issues.filter(issue => {
        const q = query.toLowerCase()
        return (
          issue.title.toLowerCase().includes(q) ||
          issue.summary?.toLowerCase().includes(q)
        )
      })
    : issues

  return (
    <div>
      <div className="mb-10">
        <label
          htmlFor={inputId}
          className="type-meta mb-2 block text-ws-black"
        >
          Search issues
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by title or topic..."
          className="w-full max-w-md rounded-[0.65rem] border border-ws-border bg-ws-white px-4 py-3 text-[17px] text-ws-black shadow-[0_14px_36px_rgba(20,17,15,0.06)] placeholder:text-ws-muted focus:border-ws-accent focus:outline-none focus:ring-2 focus:ring-ws-accent/15"
          aria-controls="issue-list"
          autoComplete="off"
          spellCheck={false}
        />
        {query.trim() && (
          <p className="type-meta mt-3" aria-live="polite">
            {filtered.length === 0
              ? 'No issues match your search.'
              : `${filtered.length} issue${filtered.length === 1 ? '' : 's'} found`}
          </p>
        )}
      </div>

      <ul id="issue-list" className="list-none space-y-10 p-0" aria-label="Newsletter issues">
        {filtered.map(issue => (
          <li key={issue.id}>
            <IssueCard issue={issue} />
          </li>
        ))}
      </ul>

      {filtered.length === 0 && !query.trim() && (
        <p className="type-card-title">No issues published yet.</p>
      )}
    </div>
  )
}
