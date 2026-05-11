import { describe, expect, it } from 'vitest'
import { deriveIssueSummary } from '@/lib/issue-summary'
import type { NotionBlock } from '@/lib/types'

function block(type: NotionBlock['type'], content: string): NotionBlock {
  return { id: `${type}-${content}`, type, content }
}

describe('deriveIssueSummary', () => {
  it('builds a short summary from sections and article titles', () => {
    const blocks = [
      block('heading_2', 'Policy & Regulation'),
      block('heading_3', 'New AI governance programme expands public-sector testing'),
      block('paragraph', 'A short article summary.'),
      block('heading_2', 'Industry & Models'),
      block('heading_3', 'OpenAI model evaluation benchmark points to enterprise AI risk'),
    ]

    expect(deriveIssueSummary(blocks, { issueNumber: 10 })).toBe(
      'Issue 10 tracks 2 stories across Policy & Regulation and Industry & Models, with signals on AI governance, public-sector AI, enterprise AI services, and frontier models.',
    )
  })

  it('returns an empty string when there are no articles to summarise', () => {
    expect(deriveIssueSummary([block('heading_2', 'Policy & Regulation')])).toBe('')
  })
})
