import { describe, expect, it } from 'vitest'
import {
  compareArticleCandidates,
  inferCandidateCategory,
  isCanadaRelevant,
  normalizeArticleCandidate,
  normalizeArticleCandidates,
  scoreArticleCandidate,
  type ArticleCandidate,
} from '@/lib/article-candidates'

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

  it('does not let low-scale automation scores suppress strong Canadian candidates', () => {
    const candidate = normalizeArticleCandidate({
      title: 'Government of Canada and TELUS advance work to build sovereign AI infrastructure',
      url: 'https://www.canada.ca/en/example',
      summary: "Canada expands sovereign artificial intelligence compute capacity.",
      source: 'Google Alerts Current RSS',
      sourceType: 'google_alerts',
      category: 'Canada',
      publishedAt: '2026-05-11T23:47:12Z',
      score: 14,
      scoreReasons: ['Direct AI relevance', 'Canadian relevance'],
    })

    expect(candidate.score).toBeGreaterThanOrEqual(75)
    expect(candidate.scoreReasons).toContain('Canadian relevance')
  })

  it('infers Canada category and relevance from Canadian source text', () => {
    const input = {
      title: 'Privacy commissioners report on OpenAI emphasizes Calgarians need for online safety',
      summary: 'Canadian privacy commissioners found issues with ChatGPT safety for youth.',
      source: 'LiveWire Calgary',
      sourceType: 'google_alerts' as const,
    }

    expect(isCanadaRelevant(input)).toBe(true)
    expect(inferCandidateCategory(input)).toBe('Policy & Regulation')
  })

  it('lets Canadian items keep stronger topical categories', () => {
    const candidate = normalizeArticleCandidate({
      title: 'Canadian privacy commissioners release AI safety findings',
      url: 'https://example.com/canadian-ai-privacy',
      summary: 'Federal and provincial privacy officials reviewed ChatGPT safety controls.',
      sourceType: 'google_alerts',
      category: 'Policy & Regulation',
    })

    expect(candidate.category).toBe('Policy & Regulation')
  })

  it('sorts Canadian candidates before non-Canadian candidates with higher raw scores', () => {
    const now = '2026-05-12T02:30:00.000Z'
    const canadian = {
      ...normalizeArticleCandidate({
        title: 'Canada releases AI governance guidance',
        url: 'https://www.canada.ca/en/example',
        summary: 'Federal AI policy update.',
        sourceType: 'google_alerts',
        category: 'Canada',
        score: 10,
      }),
      id: 'canada',
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      importedAt: null,
      rejectionReason: null,
    } satisfies ArticleCandidate
    const global = {
      ...normalizeArticleCandidate({
        title: 'Global model benchmark reaches new high score',
        url: 'https://example.com/model',
        summary: 'A new AI benchmark result.',
        sourceType: 'research',
        category: 'Research',
        score: 95,
      }),
      id: 'global',
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      importedAt: null,
      rejectionReason: null,
    } satisfies ArticleCandidate

    expect([global, canadian].sort(compareArticleCandidates)[0].id).toBe('canada')
  })
})
