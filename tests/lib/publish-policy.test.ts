import { describe, expect, it } from 'vitest'
import type { AdminCheckItem } from '@/lib/admin-readiness'
import {
  MIN_DAILY_ISSUE_ARTICLES,
  SHORT_ISSUE_CONFIRMATION,
  isLowArticleCount,
  isShortIssueConfirmation,
  splitShortIssueBlockers,
} from '@/lib/publish-policy'

function check(code: AdminCheckItem['code']): AdminCheckItem {
  return {
    code,
    label: code,
    count: 1,
    severity: 'blocker',
  }
}

describe('publish policy', () => {
  it('treats one to four articles as a short daily issue', () => {
    expect(MIN_DAILY_ISSUE_ARTICLES).toBe(5)
    expect(isLowArticleCount(0)).toBe(false)
    expect(isLowArticleCount(1)).toBe(true)
    expect(isLowArticleCount(4)).toBe(true)
    expect(isLowArticleCount(5)).toBe(false)
  })

  it('requires the exact short issue confirmation phrase', () => {
    expect(isShortIssueConfirmation(SHORT_ISSUE_CONFIRMATION)).toBe(true)
    expect(isShortIssueConfirmation(' publish short issue ')).toBe(true)
    expect(isShortIssueConfirmation('publish')).toBe(false)
  })

  it('splits short issue blockers from non-overridable blockers', () => {
    const result = splitShortIssueBlockers([
      check('low_article_count'),
      check('missing_summary'),
    ])

    expect(result.hasShortIssueBlocker).toBe(true)
    expect(result.shortIssueBlockers.map(item => item.code)).toEqual(['low_article_count'])
    expect(result.otherBlockers.map(item => item.code)).toEqual(['missing_summary'])
  })
})
