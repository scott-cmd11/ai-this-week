import { describe, expect, it } from 'vitest'
import { extractTitle, isPublishedDateFreshForIssue, parsePublishedDateText } from '@/lib/article-fetcher'

describe('article freshness guard', () => {
  it('parses publisher date strings used in issue metadata', () => {
    expect(parsePublishedDateText('Published: 9 Feb 2026')?.toISOString().slice(0, 10)).toBe('2026-02-09')
    expect(parsePublishedDateText('30 Apr 2026')?.toISOString().slice(0, 10)).toBe('2026-04-30')
  })

  it('allows issue-day and previous-two-day articles', () => {
    expect(isPublishedDateFreshForIssue('3 May 2026', '2026-05-03')).toBe(true)
    expect(isPublishedDateFreshForIssue('1 May 2026', '2026-05-03')).toBe(true)
  })

  it('rejects older background links with known publisher dates', () => {
    expect(isPublishedDateFreshForIssue('30 Apr 2026', '2026-05-03')).toBe(false)
    expect(isPublishedDateFreshForIssue('9 Feb 2026', '2026-05-03')).toBe(false)
  })

  it('does not block articles when the publisher date cannot be detected', () => {
    expect(isPublishedDateFreshForIssue(null, '2026-05-03')).toBe(true)
  })
})

describe('article title extraction', () => {
  it('decodes numeric apostrophe entities in titles', () => {
    const html = '<title>Privacy commissioners&#039; report on OpenAI - Local News</title>'
    expect(extractTitle(html)).toBe("Privacy commissioners' report on OpenAI")
  })
})
