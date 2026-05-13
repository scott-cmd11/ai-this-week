import { describe, expect, it } from 'vitest'
import {
  getPositiveStoriesFromIssues,
  getPositiveThemes,
  hasExcludedFraming,
} from '@/lib/positive-stories'
import type { Issue, NotionBlock } from '@/lib/types'

function issue(blocks: NotionBlock[]): Issue & { blocks: NotionBlock[] } {
  return {
    id: 'issue-1',
    title: 'AI Today - May 12, 2026',
    issueDate: '2026-05-12',
    issueNumber: 12,
    published: true,
    summary: '',
    aiAssisted: true,
    slug: '2026-05-12',
    blocks,
  }
}

describe('positive story filtering', () => {
  it('keeps clearly constructive health care stories', () => {
    const themes = getPositiveThemes({
      title: 'Hospital teams use AI to speed up patient discharge planning',
      summary: 'The workflow helps nurses coordinate follow-up care and gives patients clearer next steps.',
      section: 'Sectors & Applications',
      sourceUrl: 'https://example.org/health',
      sourceLabel: 'example.org',
    })

    expect(themes).toContain('Health care')
    expect(themes).toContain('Productivity')
  })

  it('rejects job-loss framing even when productivity terms are present', () => {
    expect(hasExcludedFraming({
      title: 'AI productivity tool expected to replace workers',
      summary: 'The company says the system will eliminate jobs across support teams.',
      section: 'Industry & Models',
      sourceUrl: 'https://example.com/work',
      sourceLabel: 'example.com',
    })).toBe(true)
  })

  it('rejects risk-led public-sector stories', () => {
    expect(hasExcludedFraming({
      title: 'Federal AI procurement guidance gets a practical update',
      summary: 'The update gives public teams clearer language for documenting AI risk before procurement decisions move forward.',
      section: 'Canada',
      sourceUrl: 'https://www.canada.ca/',
      sourceLabel: 'canada.ca',
    })).toBe(true)
  })

  it('parses issue blocks and returns only positive stories', () => {
    const stories = getPositiveStoriesFromIssues([
      issue([
        { id: 'canada', type: 'heading_2', content: 'Canada' },
        { id: 'negative-title', type: 'heading_3', content: 'AI tool raises job loss concerns' },
        { id: 'negative-summary', type: 'paragraph', content: 'The story focuses on job losses and risk.' },
        { id: 'negative-source', type: 'bookmark', content: 'Read more', href: 'https://example.com/jobs' },
        { id: 'negative-divider', type: 'divider', content: '' },
        { id: 'apps', type: 'heading_2', content: 'Sectors & Applications' },
        { id: 'positive-title', type: 'heading_3', content: 'AI tutor helps students practise math after school' },
        { id: 'positive-date', type: 'paragraph', content: 'Published: 2026-05-12' },
        {
          id: 'positive-summary',
          type: 'paragraph',
          content: 'The classroom tool supports teachers and gives students more time for guided learning.',
        },
        { id: 'positive-source', type: 'bookmark', content: 'Read more', href: 'https://example.edu/story' },
      ]),
    ])

    expect(stories).toHaveLength(1)
    expect(stories[0]).toMatchObject({
      title: 'AI tutor helps students practise math after school',
      section: 'Sectors & Applications',
      publishedDate: '2026-05-12',
      sourceLabel: 'example.edu',
    })
    expect(stories[0].themes).toContain('Education')
  })
})
