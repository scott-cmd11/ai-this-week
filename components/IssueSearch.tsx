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
      <div className="mb-8">
        <label htmlFor={inputId} className="block text-[17px] font-bold text-govuk-black mb-2">
          Search issues
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by title or topic…"
          className="w-full max-w-md border-2 border-govuk-black dark:border-govuk-mid-grey px-3 py-2 text-[17px] text-govuk-black dark:text-govuk-light-grey bg-white dark:bg-govuk-light-grey focus:outline-none focus:ring-4 focus:ring-govuk-yellow placeholder:text-govuk-dark-grey"
          aria-controls="issue-list"
          autoComplete="off"
          spellCheck={false}
        />
        {query.trim() && (
          <p className="text-[15px] text-govuk-dark-grey mt-2" aria-live="polite">
            {filtered.length === 0
              ? 'No issues match your search.'
              : `${filtered.length} issue${filtered.length === 1 ? '' : 's'} found`}
          </p>
        )}
      </div>

      {/* Results */}
      <ul id="issue-list" className="space-y-8 list-none p-0" aria-label="Newsletter issues">
        {filtered.map(issue => (
          <li key={issue.id}>
            <IssueCard issue={issue} />
          </li>
        ))}
      </ul>

      {filtered.length === 0 && !query.trim() && (
        <p className="text-[19px] text-govuk-black">No issues published yet.</p>
      )}
    </div>
  )
}
