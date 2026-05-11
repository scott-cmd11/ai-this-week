import { describe, expect, it } from 'vitest'
import { deriveIssueDigest, deriveIssueSummary, extractIssueArticles } from '@/lib/issue-summary'
import type { NotionBlock } from '@/lib/types'

function block(type: NotionBlock['type'], content: string): NotionBlock {
  return { id: `${type}-${content}`, type, content }
}

describe('deriveIssueSummary', () => {
  it('builds an editorial hook from sections, titles, and summaries', () => {
    const blocks = [
      block('heading_2', 'Policy & Regulation'),
      block('heading_3', 'New AI governance programme expands public-sector testing'),
      block('paragraph', 'The programme gives public agencies a way to test AI systems before they are used in services.'),
      block('heading_2', 'Industry & Models'),
      block('heading_3', 'OpenAI model evaluation benchmark points to enterprise AI risk'),
      block('paragraph', 'The benchmark compares model reliability across tasks that matter for enterprise adoption.'),
    ]

    expect(deriveIssueSummary(blocks, { issueNumber: 10 })).toBe(
      'AI is moving from capability claims into questions of oversight, measurement, and institutional use. Issue 10 connects AI governance, public-sector AI, enterprise AI services, and frontier models, showing where AI is becoming a question of trust, oversight, and practical use.',
    )
  })

  it('returns key developments for the homepage issue feature', () => {
    const digest = deriveIssueDigest([
      block('heading_2', 'Policy & Regulation'),
      block('heading_3', 'AI governance programme expands public-sector testing'),
      block('paragraph', 'Public agencies get a clearer way to test AI systems before they are used in live services.'),
      block('heading_2', 'Research'),
      block('heading_3', 'New model evaluation study measures reliability risks'),
      block('paragraph', 'Researchers compare model reliability across tasks that affect safety and adoption.'),
      block('heading_2', 'Upcoming'),
      block('heading_3', 'Learning evening'),
      block('paragraph', 'When: June 1'),
    ], { issueNumber: 11 })

    expect(digest.storyCount).toBe(2)
    expect(digest.keyDevelopments).toEqual([
      'Public agencies get a clearer way to test AI systems before they are used in live services.',
      'Researchers compare model reliability across tasks that affect safety and adoption.',
    ])
  })

  it('extracts article summaries without metadata lines', () => {
    const articles = extractIssueArticles([
      block('heading_2', 'Research'),
      block('heading_3', 'A model evaluation story'),
      block('paragraph', 'Published: 2026-05-10'),
      block('paragraph', 'Researchers tested the model on tasks that need consistent answers.'),
    ])

    expect(articles).toEqual([
      {
        section: 'Research',
        title: 'A model evaluation story',
        summary: 'Researchers tested the model on tasks that need consistent answers.',
      },
    ])
  })

  it('returns an empty string when there are no articles to summarise', () => {
    expect(deriveIssueSummary([block('heading_2', 'Policy & Regulation')])).toBe('')
  })
})
