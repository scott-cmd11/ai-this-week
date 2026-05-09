import { describe, expect, it } from 'vitest'
import { normalizeArticleCandidate, normalizeArticleCandidates, scoreArticleCandidate } from '@/lib/article-candidates'

describe('article candidates', () => {
  it('normalizes URLs and defaults candidate fields', () => {
    const candidate = normalizeArticleCandidate({
      title: '  Canada releases AI guidance  ',
      url: 'https://www.canada.ca/en/example?utm_source=alerts',
      summary: '  Public-sector guidance.  ',
      sourceType: 'canada_briefing',
      category: 'Government & Public Sector',
    })

    expect(candidate.title).toBe('Canada releases AI guidance')
    expect(candidate.canonicalUrl).toBe('https://canada.ca/en/example')
    expect(candidate.source).toBe('Unknown source')
    expect(candidate.status).toBe('new')
    expect(candidate.category).toBe('Government & Public Sector')
    expect(candidate.score).toBeGreaterThan(40)
  })

  it('deduplicates same-batch candidates by canonical URL', () => {
    const candidates = normalizeArticleCandidates([
      { title: 'First', url: 'https://example.com/post?utm_campaign=x' },
      { title: 'Second', url: 'https://www.example.com/post' },
    ])

    expect(candidates).toHaveLength(1)
    expect(candidates[0].title).toBe('First')
  })

  it('scores weak promotional sources lower than primary Canadian sources', () => {
    const now = new Date('2026-05-08T12:00:00-05:00')
    const strong = scoreArticleCandidate({
      title: 'Government of Canada announces AI public sector guidance',
      source: 'canada.ca',
      sourceType: 'canada_briefing',
      publishedAt: '2026-05-08T10:00:00-05:00',
    }, now)
    const weak = scoreArticleCandidate({
      title: 'Sponsored crypto AI press release distribution roundup',
      source: 'PR Newswire',
      sourceType: 'google_alerts',
      publishedAt: '2026-04-20T10:00:00-05:00',
    }, now)

    expect(strong.score).toBeGreaterThan(weak.score)
    expect(strong.reasons).toContain('Canadian relevance')
    expect(weak.reasons).toContain('Weak or promotional source signal')
  })
})
