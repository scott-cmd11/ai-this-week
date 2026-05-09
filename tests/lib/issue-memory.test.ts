import { describe, expect, it } from 'vitest'
import { findIssueMemoryWarnings } from '@/lib/issue-memory'

describe('issue memory warnings', () => {
  it('flags likely same stories by similar title', () => {
    const warnings = findIssueMemoryWarnings(
      'OpenAI expands Canadian public sector data residency',
      [
        {
          title: 'OpenAI announces Canada public sector data residency expansion',
          issueNumber: 8,
          issueDate: '2026-05-08',
        },
      ],
    )

    expect(warnings[0]?.level).toBe('likely_same_story')
    expect(warnings[0]?.issueNumber).toBe(8)
  })

  it('flags related topics when high-signal entities overlap', () => {
    const warnings = findIssueMemoryWarnings(
      'Ottawa privacy commissioner reviews federal AI procurement rules',
      [
        {
          title: 'Federal privacy commissioner questions Ottawa AI procurement process',
          issueNumber: 7,
          issueDate: '2026-05-07',
        },
      ],
    )

    expect(warnings.some(warning => warning.level === 'related_topic' || warning.level === 'likely_same_story')).toBe(true)
  })

  it('does not flag unrelated AI news', () => {
    const warnings = findIssueMemoryWarnings(
      'Nvidia releases new robotics model benchmark',
      [
        {
          title: 'Federal privacy commissioner questions Ottawa AI procurement process',
          issueNumber: 7,
          issueDate: '2026-05-07',
        },
      ],
    )

    expect(warnings).toHaveLength(0)
  })
})
