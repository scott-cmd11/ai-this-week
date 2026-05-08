import { describe, expect, it } from 'vitest'
import { findSimilarTitle, titleSimilarity } from '@/lib/title-dedupe'

describe('title dedupe', () => {
  it('matches similar article subjects even when wording differs', () => {
    const score = titleSimilarity(
      'OpenAI expands Canadian public sector data residency',
      'OpenAI announces Canada public sector data residency expansion',
    )

    expect(score).toBeGreaterThanOrEqual(0.62)
  })

  it('finds the strongest similar existing title', () => {
    const match = findSimilarTitle('Ottawa releases new AI procurement guidance', [
      { title: 'Chip stocks rally after earnings' },
      { title: 'Ottawa publishes AI procurement guidance for departments' },
    ])

    expect(match?.title).toBe('Ottawa publishes AI procurement guidance for departments')
  })

  it('does not match unrelated short titles', () => {
    const match = findSimilarTitle('New model benchmark released', [
      { title: 'Federal privacy commissioner launches investigation' },
    ])

    expect(match).toBeNull()
  })
})
