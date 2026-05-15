import type { AdminCheckItem, AdminDraftSummary, AdminEveningBriefingSummary, AdminReadiness } from './admin-readiness'
import { DAILY_PUBLISH_ARTICLE_TARGET } from './admin-readiness'
import { MIN_DAILY_ISSUE_ARTICLES } from './publish-policy'

export const AUTOPUBLISH_TARGET_ARTICLES = DAILY_PUBLISH_ARTICLE_TARGET
export const AUTOPUBLISH_MIN_ARTICLES = MIN_DAILY_ISSUE_ARTICLES

const TOLERATED_WARNING_CODES = new Set<AdminCheckItem['code']>([
  'missing_image',
  'uneven_sections',
  'held_candidates',
  'imported_without_issue_context',
])

export type AutopublishDecisionReason =
  | 'ready'
  | 'already_published'
  | 'no_draft'
  | 'empty'
  | 'low_article_count'
  | 'source_freshness'
  | 'publish_readiness'

export interface AutopublishDecision {
  publishable: boolean
  reason: AutopublishDecisionReason
  articleCount: number
  minimumArticleCount: number
  targetArticleCount: number
  blockers: AdminCheckItem[]
  blockingWarnings: AdminCheckItem[]
  toleratedWarnings: AdminCheckItem[]
  notes: string[]
}

export function evaluateAutopublishDecision({
  draft,
  readiness,
  eveningBriefing,
  minimumArticleCount = AUTOPUBLISH_MIN_ARTICLES,
  targetArticleCount = AUTOPUBLISH_TARGET_ARTICLES,
}: {
  draft: AdminDraftSummary
  readiness: AdminReadiness
  eveningBriefing: AdminEveningBriefingSummary
  minimumArticleCount?: number
  targetArticleCount?: number
}): AutopublishDecision {
  const notes: string[] = []
  const articleCount = draft.articleCount
  const blockingWarnings = readiness.warnings.filter(warning => !TOLERATED_WARNING_CODES.has(warning.code))
  const toleratedWarnings = readiness.warnings.filter(warning => TOLERATED_WARNING_CODES.has(warning.code))

  if (articleCount > 0 && articleCount < targetArticleCount) {
    notes.push(`Draft has ${articleCount}/${targetArticleCount} target articles. Autopilot can publish above the minimum when sources are otherwise healthy.`)
  }

  if (eveningBriefing.state === 'low_volume') {
    notes.push('Candidate volume is low, but autopilot may still publish if the draft meets the minimum article count and source freshness is current.')
  }

  if (draft.published) {
    return {
      publishable: false,
      reason: 'already_published',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: [],
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  if (!draft.exists) {
    return {
      publishable: false,
      reason: 'no_draft',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: [],
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  if (articleCount === 0) {
    return {
      publishable: false,
      reason: 'empty',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: readiness.blockers,
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  if (articleCount < minimumArticleCount) {
    return {
      publishable: false,
      reason: 'low_article_count',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: readiness.blockers,
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  if (['waiting', 'stale', 'source_error'].includes(eveningBriefing.state)) {
    return {
      publishable: false,
      reason: 'source_freshness',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: readiness.blockers,
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  if (readiness.blockers.length > 0 || blockingWarnings.length > 0) {
    return {
      publishable: false,
      reason: 'publish_readiness',
      articleCount,
      minimumArticleCount,
      targetArticleCount,
      blockers: readiness.blockers,
      blockingWarnings,
      toleratedWarnings,
      notes,
    }
  }

  return {
    publishable: true,
    reason: 'ready',
    articleCount,
    minimumArticleCount,
    targetArticleCount,
    blockers: [],
    blockingWarnings: [],
    toleratedWarnings,
    notes,
  }
}
