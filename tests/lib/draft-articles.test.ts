import { describe, expect, it } from 'vitest'
import { parseDailyArticles } from '@/lib/draft-articles'

describe('parseDailyArticles', () => {
  it('keeps parsing articles after many non-article blocks', () => {
    const filler = Array.from({ length: 120 }, (_, index) => ({
      id: `filler-${index}`,
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: `Filler ${index}` }] },
    }))
    const blocks = [
      {
        id: 'category',
        type: 'heading_2',
        heading_2: { rich_text: [{ plain_text: 'Canada' }] },
      },
      ...filler,
      {
        id: 'title',
        type: 'heading_3',
        heading_3: { rich_text: [{ plain_text: 'Late draft article' }] },
      },
      {
        id: 'published',
        type: 'paragraph',
        paragraph: { rich_text: [{ plain_text: 'Published: 2026-05-07' }] },
      },
      {
        id: 'annotation',
        type: 'paragraph',
        paragraph: { rich_text: [{ plain_text: 'A useful editor summary.' }] },
      },
      { id: 'bookmark', type: 'bookmark', bookmark: { url: 'https://example.com/article' } },
      {
        id: 'image',
        type: 'image',
        image: { external: { url: 'https://example.com/image.jpg' } },
      },
      { id: 'divider', type: 'divider', divider: {} },
    ]

    expect(parseDailyArticles(blocks)).toEqual([
      {
        title: 'Late draft article',
        annotation: 'A useful editor summary.',
        url: 'https://example.com/article',
        imageUrl: 'https://example.com/image.jpg',
        annotationBlockId: 'annotation',
        category: 'Canada',
      },
    ])
  })
})
