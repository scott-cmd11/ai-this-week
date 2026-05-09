import { describe, expect, it } from 'vitest'
import { findSubjectDuplicate, subjectDuplicateMessage } from '@/lib/article-dedupe'

describe('article subject dedupe', () => {
  it('flags similar subjects from prior issues', () => {
    const result = findSubjectDuplicate(
      'Ottawa releases new AI procurement guidance',
      [{ title: 'Ottawa publishes AI procurement guidance for departments', issueNumber: 12, issueDate: '2026-05-07' }],
      [],
    )

    expect(result).toEqual({
      duplicate: true,
      scope: 'recent_issue',
      title: 'Ottawa publishes AI procurement guidance for departments',
      issueNumber: 12,
      issueDate: '2026-05-07',
    })
    expect(subjectDuplicateMessage(result)).toBe(
      'Similar subject already exists in Issue #12 (2026-05-07): Ottawa publishes AI procurement guidance for departments',
    )
  })

  it('flags similar subjects in the same assemble/import batch', () => {
    const result = findSubjectDuplicate(
      'OpenAI expands Canadian public sector data residency',
      [],
      [{ title: 'OpenAI announces Canada public sector data residency expansion' }],
    )

    expect(result).toEqual({
      duplicate: true,
      scope: 'current_batch',
      title: 'OpenAI announces Canada public sector data residency expansion',
      issueNumber: undefined,
      issueDate: undefined,
    })
  })

  it('allows unrelated subjects', () => {
    expect(findSubjectDuplicate(
      'New model benchmark released',
      [{ title: 'Federal privacy commissioner launches investigation' }],
      [],
    )).toEqual({ duplicate: false })
  })
})
