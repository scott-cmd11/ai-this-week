import { describe, expect, it } from 'vitest'
import { parseBriefingBlocks } from '@/lib/briefing-parser'

function heading(text: string) {
  return {
    type: 'heading_2',
    heading_2: { rich_text: [{ plain_text: text }] },
  }
}

function bullet(segments: Array<{ text: string; link?: string | null; bold?: boolean }>) {
  return {
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: segments.map(segment => ({
        plain_text: segment.text,
        href: segment.link ?? null,
        text: { link: segment.link ? { url: segment.link } : null },
        annotations: { bold: !!segment.bold },
      })),
    },
  }
}

describe('parseBriefingBlocks', () => {
  it('ignores feed health diagnostics with fallback URLs', () => {
    const briefing = parseBriefingBlocks([
      heading('Feed Health'),
      bullet([
        { text: 'Jack Clark - Import AI: RSS fetch failed; web fallback OK (' },
        { text: 'https://jack-clark.net/', link: 'https://jack-clark.net/' },
        { text: ')' },
      ]),
      heading('Research'),
      bullet([
        { text: 'AI system accelerates molecule design', link: 'https://example.com/research', bold: true },
        { text: ' - A lab reports a useful new benchmark for scientific AI tools.' },
      ]),
    ])

    expect(briefing.sections).toHaveLength(1)
    expect(briefing.sections[0].name).toBe('Research')
    expect(briefing.sections[0].articles).toHaveLength(1)
    expect(briefing.sections[0].articles[0].title).toBe('AI system accelerates molecule design')
  })

  it('does not treat a bare URL link as an article title', () => {
    const briefing = parseBriefingBlocks([
      heading('Sectors & Applications'),
      bullet([
        { text: 'Archive fallback: ' },
        { text: 'https://example.com/archive', link: 'https://example.com/archive' },
      ]),
    ])

    expect(briefing.sections[0].articles).toHaveLength(0)
  })
})
