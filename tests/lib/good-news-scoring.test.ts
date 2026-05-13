import { describe, expect, it } from 'vitest'
import { scoreGoodNewsCandidate } from '@/lib/good-news-scoring'

describe('AI Good News scoring', () => {
  it('accepts beneficial, evidence-linked AI stories', () => {
    const score = scoreGoodNewsCandidate({
      title: 'Randomized trial uses AI to support breast cancer screening',
      source_name: 'Nature Medicine',
      source_url: 'https://www.nature.com/articles/s41591-024-03093-5',
      summary: 'A clinical trial reported measured screening results from an AI-assisted workflow.',
      content_text: 'Researchers report a randomized study with patient screening evidence.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Health',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Health')
    expect(score.credibility_score).toBeGreaterThanOrEqual(70)
    expect(score.positivity_score).toBeGreaterThanOrEqual(55)
  })

  it('rejects job-loss and stock-market framing', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI stock jumps after tool replaces workers',
      source_name: 'Market wire',
      source_url: 'https://example.com/stock',
      summary: 'The story focuses on shares, layoffs, and replacing workers.',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/Excluded framing/)
  })

  it('accepts AI accessibility stories with practical human benefit', () => {
    const score = scoreGoodNewsCandidate({
      title: 'AI-powered captions help students follow classroom lessons',
      source_name: 'Microsoft Accessibility Blog',
      source_url: 'https://blogs.microsoft.com/accessibility/example',
      summary: 'A deployed assistive tool improves accessibility for students with hearing loss.',
      content_text: 'The accessibility team describes an implemented feature with inclusive design evidence.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Accessibility',
    })

    expect(score.accepted).toBe(true)
    expect(score.category).toBe('Accessibility')
    expect(score.evidence_notes).toMatch(/AI relevance signals/)
  })

  it('rejects broad positive stories when AI relevance is unclear', () => {
    const score = scoreGoodNewsCandidate({
      title: 'New accessibility guide helps local business owners',
      source_name: 'Digital Main Street',
      source_url: 'https://digitalmainstreet.ca/example',
      summary: 'The guide shares inclusive design practices for storefront websites.',
      published_at: '2026-05-12T12:00:00.000Z',
      category: 'Small Business',
    })

    expect(score.accepted).toBe(false)
    expect(score.rejection_reasons.join(' ')).toMatch(/No clear AI relevance signal/)
  })
})
