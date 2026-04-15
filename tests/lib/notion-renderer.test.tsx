import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotionRenderer } from '@/lib/notion-renderer'
import type { NotionBlock } from '@/lib/types'

describe('NotionRenderer', () => {
  it('renders a paragraph block', () => {
    const blocks: NotionBlock[] = [
      { id: '1', type: 'paragraph', content: 'Hello world' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByText('Hello world').tagName).toBe('P')
  })

  it('renders a heading_2 block as h2', () => {
    const blocks: NotionBlock[] = [
      { id: '2', type: 'heading_2', content: 'Section Title' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Section Title' })).toBeInTheDocument()
  })

  it('renders bulleted list items as a ul > li structure', () => {
    const blocks: NotionBlock[] = [
      { id: '3', type: 'bulleted_list_item', content: 'First item' },
      { id: '4', type: 'bulleted_list_item', content: 'Second item' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('UL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('groups consecutive bulleted list items into one ul', () => {
    const blocks: NotionBlock[] = [
      { id: '5', type: 'bulleted_list_item', content: 'Item A' },
      { id: '6', type: 'bulleted_list_item', content: 'Item B' },
      { id: '7', type: 'paragraph', content: 'After the list' },
      { id: '8', type: 'bulleted_list_item', content: 'Item C' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getAllByRole('list')).toHaveLength(2)
  })

  it('renders a bookmark block as a link with accessible text', () => {
    const blocks: NotionBlock[] = [
      { id: '9', type: 'bookmark', content: 'Read the article', href: 'https://example.com' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    const link = screen.getByRole('link', { name: /read the article/i })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders a bookmark link with "(opens in new tab)" for screen readers', () => {
    const blocks: NotionBlock[] = [
      { id: '10', type: 'bookmark', content: 'Read more', href: 'https://example.com' },
    ]
    render(<NotionRenderer blocks={blocks} />)
    expect(screen.getByText('(opens in new tab)').className).toContain('sr-only')
  })

  it('renders a divider as hr', () => {
    const blocks: NotionBlock[] = [
      { id: '11', type: 'divider', content: '' },
    ]
    const { container } = render(<NotionRenderer blocks={blocks} />)
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  it('skips empty paragraph blocks', () => {
    const blocks: NotionBlock[] = [
      { id: '12', type: 'paragraph', content: '' },
    ]
    const { container } = render(<NotionRenderer blocks={blocks} />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
  })
})
