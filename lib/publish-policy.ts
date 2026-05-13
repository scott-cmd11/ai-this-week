import type { AdminCheckItem } from './admin-readiness'

export const MIN_DAILY_ISSUE_ARTICLES = 5
export const SHORT_ISSUE_CONFIRMATION = 'PUBLISH SHORT ISSUE'

export function isLowArticleCount(articleCount: number): boolean {
  return articleCount > 0 && articleCount < MIN_DAILY_ISSUE_ARTICLES
}

export function isShortIssueConfirmation(value: string | null | undefined): boolean {
  return value?.trim().toUpperCase() === SHORT_ISSUE_CONFIRMATION
}

export function splitShortIssueBlockers(blockers: AdminCheckItem[]) {
  const shortIssueBlockers = blockers.filter(blocker => blocker.code === 'low_article_count')
  const otherBlockers = blockers.filter(blocker => blocker.code !== 'low_article_count')
  return {
    shortIssueBlockers,
    otherBlockers,
    hasShortIssueBlocker: shortIssueBlockers.length > 0,
  }
}
