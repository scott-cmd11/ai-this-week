import { describe, expect, it } from 'vitest'
import { generateDailyDigest } from '@/lib/good-news-digest'
import type { GoodNewsStory } from '@/lib/good-news-types'

function story(overrides: Partial<GoodNewsStory>): GoodNewsStory {
  return {
    id: overrides.id ?? 'story',
    title: overrides.title ?? 'AI helps a public-service team improve access',
    source_name: overrides.source_name ?? 'Public source',
    source_url: overrides.source_url ?? `https://example.com/${overrides.id ?? 'story'}`,
    canonical_url: overrides.canonical_url ?? `https://example.com/${overrides.id ?? 'story'}`,
    published_at: overrides.published_at ?? '2026-05-12T10:00:00.000Z',
    discovered_at: overrides.discovered_at ?? '2026-05-12T11:00:00.000Z',
    summary: overrides.summary ?? 'A named organization used AI in a measured, beneficial workflow.',
    why_it_matters: overrides.why_it_matters ?? 'The story shows practical public benefit with evidence.',
    category: overrides.category ?? 'Public Good',
    tags: overrides.tags ?? ['public-service'],
    positivity_score: overrides.positivity_score ?? 82,
    credibility_score: overrides.credibility_score ?? 84,
    evidence_notes: overrides.evidence_notes ?? 'Named organization, source link, and concrete use case.',
    status: overrides.status ?? 'published',
  }
}

describe('AI Good News digest generation', () => {
  it('selects recent published stories and avoids duplicate syndicated items', () => {
    const digest = generateDailyDigest([
      story({ id: 'health', title: 'AI helps clinical teams review scans', category: 'Health', credibility_score: 90, positivity_score: 86 }),
      story({ id: 'climate', title: 'AI model improves regional weather forecasts', category: 'Climate', credibility_score: 88, positivity_score: 83 }),
      story({ id: 'climate-copy', title: 'Regional weather forecasts improve with AI model', category: 'Climate', canonical_url: 'https://mirror.example/weather', source_url: 'https://mirror.example/weather' }),
      story({ id: 'education', title: 'AI tutor supports teachers with practice feedback', category: 'Education', credibility_score: 80, positivity_score: 81 }),
      story({ id: 'accessibility', title: 'AI accessibility tool helps people find objects', category: 'Accessibility', credibility_score: 86, positivity_score: 88 }),
      story({ id: 'old-evergreen', title: 'AI research fixture from an earlier year', published_at: '2024-05-12T10:00:00.000Z', credibility_score: 99, positivity_score: 99 }),
      story({ id: 'rejected', title: 'AI tool enters review', status: 'pending' }),
    ], new Date('2026-05-12T18:00:00.000Z'))

    expect(digest.id).toBe('digest-2026-05-12')
    expect(digest.story_ids).toContain('health')
    expect(digest.story_ids).not.toContain('rejected')
    expect(digest.story_ids).not.toContain('climate-copy')
    expect(digest.story_ids).not.toContain('old-evergreen')
    expect(digest.story_ids.length).toBeGreaterThanOrEqual(4)
    expect(digest.headline).toMatch(/AI Good News/)
  })
})
