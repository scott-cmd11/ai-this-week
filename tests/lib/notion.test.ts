import { describe, it, expect } from 'vitest'
import { mapPageToIssue, mapBlockToNotionBlock } from '@/lib/notion'

describe('mapPageToIssue', () => {
  it('maps a Notion page to an Issue', () => {
    const fakePage = {
      id: 'page-123',
      properties: {
        Title: { title: [{ plain_text: 'AI This Week — Apr 14, 2026' }] },
        'Issue Date': { date: { start: '2026-04-14' } },
        'Issue Number': { number: 42 },
        Published: { checkbox: true },
        Summary: { rich_text: [{ plain_text: 'Weekly AI roundup.' }] },
        'AI Assisted': { checkbox: true },
      },
    }

    const issue = mapPageToIssue(fakePage)

    expect(issue).toEqual({
      id: 'page-123',
      title: 'AI This Week — Apr 14, 2026',
      issueDate: '2026-04-14',
      issueNumber: 42,
      published: true,
      summary: 'Weekly AI roundup.',
      aiAssisted: true,
      slug: '2026-04-14',
    })
  })

  it('handles missing optional fields gracefully', () => {
    const fakePage = {
      id: 'page-456',
      properties: {
        Title: { title: [] },
        'Issue Date': { date: null },
        'Issue Number': { number: null },
        Published: { checkbox: false },
        Summary: { rich_text: [] },
        'AI Assisted': { checkbox: false },
      },
    }

    const issue = mapPageToIssue(fakePage)

    expect(issue.title).toBe('')
    expect(issue.issueDate).toBe('')
    expect(issue.issueNumber).toBe(0)
    expect(issue.summary).toBe('')
  })
})

describe('mapBlockToNotionBlock', () => {
  it('maps a paragraph block', () => {
    const block = {
      id: 'block-1',
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: 'Hello world' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-1', type: 'paragraph', content: 'Hello world' })
  })

  it('maps a heading_2 block', () => {
    const block = {
      id: 'block-2',
      type: 'heading_2',
      heading_2: { rich_text: [{ plain_text: 'Bright Spot' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-2', type: 'heading_2', content: 'Bright Spot' })
  })

  it('maps a bookmark block', () => {
    const block = {
      id: 'block-3',
      type: 'bookmark',
      bookmark: { url: 'https://example.com', caption: [{ plain_text: 'Read more' }] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({
      id: 'block-3',
      type: 'bookmark',
      content: 'Read more',
      href: 'https://example.com',
    })
  })

  it('maps a bookmark block with no caption to default text', () => {
    const block = {
      id: 'block-4',
      type: 'bookmark',
      bookmark: { url: 'https://example.com', caption: [] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result.content).toBe('Read more')
  })

  it('maps a divider block', () => {
    const block = { id: 'block-5', type: 'divider', divider: {} }
    const result = mapBlockToNotionBlock(block)
    expect(result).toEqual({ id: 'block-5', type: 'divider', content: '' })
  })

  it('maps an unknown block type to a paragraph with empty content', () => {
    const block = {
      id: 'block-6',
      type: 'unsupported_type',
      unsupported_type: { rich_text: [] },
    }
    const result = mapBlockToNotionBlock(block)
    expect(result.type).toBe('paragraph')
    expect(result.content).toBe('')
  })
})
