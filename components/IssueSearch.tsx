'use client'

import { useState, useId } from 'react'
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
      {/* Search input */}
      <div className="mb-10">
        <label
          htmlFor={inputId}
          className="block text-[15px] font-black uppercase tracking-wide text-ws-black mb-2"
        >
          Search issues
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by title or topic…"
          className="w-full max-w-md border-[3px] border-ws-black px-4 py-3 text-[17px] text-ws-black bg-ws-white shadow-[4px_4px_0_0_var(--color-ws-black)] focus:outline-none focus:shadow-[6px_6px_0_0_var(--color-ws-accent)] focus:border-ws-accent placeholder:text-ws-black/50"
          aria-controls="issue-list"
          autoComplete="off"
          spellCheck={false}
        />
        {query.trim() && (
          <p className="text-[14px] font-bold uppercase tracking-wide mt-3" aria-live="polite">
            {filtered.length === 0
              ? 'No issues match your search.'
              : `${filtered.length} issue${filtered.length === 1 ? '' : 's'} found`}
          </p>
        )}
      </div>

      {/* Results */}
      <ul id="issue-list" className="space-y-10 list-none p-0" aria-label="Newsletter issues">
        {filtered.map(issue => (
          <li key={issue.id}>
            <IssueCard issue={issue} />
          </li>
        ))}
      </ul>

      {filtered.length === 0 && !query.trim() && (
        <p className="text-[19px] font-bold text-ws-black">No issues published yet.</p>
      )}
    </div>
  )
}
