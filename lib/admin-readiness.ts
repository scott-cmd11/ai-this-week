import { isLowArticleCount } from './publish-policy'

export type DailyRunStep = 'status' | 'intake' | 'choose' | 'edit' | 'check' | 'publish'

export type DraftState = 'not_started' | 'in_progress' | 'ready_to_check' | 'published'

export interface AdminAutomationSummary {
  lastRunAt: string | null
  sourceCount: number
  failureCount: number
}

export interface AdminCandidateSummary {
  totalActive: number
  topPicks: number
  held: number
  rejected: number
  imported: number
  importedWithoutIssueContext: number
}

export interface AdminDraftSummary {
  exists: boolean
  published: boolean
  issueId: string | null
  issueNumber: number | null
  issueDate: string
  articleCount: number
  sections: string[]
  missingSummaryCount: number
  missingTitleCount: number
  exactDuplicateUrlCount: number
  similarTopicCount: number
  staleSourceCount: number
  weakTitleCount: number
  missingImageCount: number
  brokenRequiredUrlCount: number
  publishReadinessFailed: boolean
}

export interface AdminCheckItem {
  code:
    | 'no_articles'
    | 'exact_duplicate_url'
    | 'missing_title'
    | 'missing_summary'
    | 'broken_required_url'
    | 'publish_readiness_failed'
    | 'similar_topic'
    | 'stale_source'
    | 'weak_title'
    | 'missing_image'
    | 'uneven_sections'
    | 'held_candidates'
    | 'low_article_count'
    | 'active_candidates_after_publish'
    | 'imported_without_issue_context'
    | 'automation_failure'
  label: string
  count: number
  severity: 'blocker' | 'warning'
}

export interface AdminReadinessInput {
  issueDate: string
  automation: AdminAutomationSummary
  candidates: AdminCandidateSummary
  draft: AdminDraftSummary
}

export interface AdminReadiness {
  issueDate: string
  draftState: DraftState
  blockers: AdminCheckItem[]
  warnings: AdminCheckItem[]
  nextBestAction: string
  primaryAction: {
    label: string
    step?: DailyRunStep
    href?: string
  }
}

export function adminChecksFingerprint(items: AdminCheckItem[]): string {
  return items
    .map(item => `${item.severity}:${item.code}:${item.count}:${item.label}`)
    .sort()
    .join('|')
}

function item(
  code: AdminCheckItem['code'],
  label: string,
  count: number,
  severity: AdminCheckItem['severity'],
): AdminCheckItem | null {
  if (count <= 0) return null
  return { code, label, count, severity }
}

function compact(items: Array<AdminCheckItem | null>): AdminCheckItem[] {
  return items.filter((entry): entry is AdminCheckItem => Boolean(entry))
}

function hasUnevenSections(draft: AdminDraftSummary): boolean {
  return draft.articleCount >= 6 && draft.sections.length <= 2
}

export function buildAdminReadiness(input: AdminReadinessInput): AdminReadiness {
  const { automation, candidates, draft } = input

  const blockers = compact([
    item('no_articles', 'No articles in draft', draft.exists && !draft.published && draft.articleCount === 0 ? 1 : 0, 'blocker'),
    item('exact_duplicate_url', 'Exact duplicate URL', draft.exactDuplicateUrlCount, 'blocker'),
    item('missing_title', 'Missing title', draft.missingTitleCount, 'blocker'),
    item('missing_summary', 'Missing summary', draft.missingSummaryCount, 'blocker'),
    item('broken_required_url', 'Broken required source URL', draft.brokenRequiredUrlCount, 'blocker'),
    item('publish_readiness_failed', 'Publish readiness failed', draft.publishReadinessFailed ? 1 : 0, 'blocker'),
    item('low_article_count', 'Very low article count', draft.exists && !draft.published && isLowArticleCount(draft.articleCount) ? 1 : 0, 'blocker'),
  ])

  const warnings = compact([
    item('similar_topic', 'Similar topic from recent issue', draft.similarTopicCount, 'warning'),
    item('stale_source', 'Older or stale source date', draft.staleSourceCount, 'warning'),
    item('weak_title', 'Weak title', draft.weakTitleCount, 'warning'),
    item('missing_image', 'Missing image', draft.missingImageCount, 'warning'),
    item('uneven_sections', 'Uneven section balance', hasUnevenSections(draft) ? 1 : 0, 'warning'),
    item('held_candidates', 'Held candidates still unresolved', candidates.held, 'warning'),
    item('low_article_count', 'Very low article count', draft.exists && draft.published && isLowArticleCount(draft.articleCount) ? 1 : 0, 'warning'),
    item('active_candidates_after_publish', 'Active candidates still waiting after publish', draft.published ? candidates.totalActive : 0, 'warning'),
    item('imported_without_issue_context', 'Imported candidates missing issue match', candidates.importedWithoutIssueContext, 'warning'),
    item('automation_failure', 'Automation source failure', automation.failureCount, 'warning'),
  ])

  if (draft.published) {
    const publishedLowWithCandidates = isLowArticleCount(draft.articleCount) && candidates.totalActive > 0
    const publishedLow = isLowArticleCount(draft.articleCount)
    return {
      issueDate: input.issueDate,
      draftState: 'published',
      blockers: [],
      warnings,
      nextBestAction: publishedLowWithCandidates
        ? `Issue is published with only ${draft.articleCount} articles while ${candidates.totalActive} candidates remain active. Use Issue Desk to append more coverage.`
        : publishedLow
          ? `Issue is published with only ${draft.articleCount} articles. Use Issue Desk if this needs repair.`
          : 'Issue is published. Use Issue Desk for corrections.',
      primaryAction: { label: 'View published issue', href: `/issues/${draft.issueDate}` },
    }
  }

  if (!draft.exists) {
    return {
      issueDate: input.issueDate,
      draftState: 'not_started',
      blockers,
      warnings,
      nextBestAction: candidates.totalActive > 0
        ? `Review ${candidates.totalActive} candidates from today's automations.`
        : 'No draft exists yet. Add an article or learning event to start today\'s issue.',
      primaryAction: { label: "Start today's issue", step: candidates.totalActive > 0 ? 'choose' : 'edit' },
    }
  }

  if (blockers.length > 0) {
    const onlyLowArticleBlocker = blockers.length === 1 && blockers[0]?.code === 'low_article_count'
    return {
      issueDate: input.issueDate,
      draftState: 'in_progress',
      blockers,
      warnings,
      nextBestAction: onlyLowArticleBlocker
        ? `Draft has only ${draft.articleCount} articles. Add more candidates before publishing, or use the explicit short-issue override.`
        : `Fix ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} before publishing.`,
      primaryAction: { label: 'Fix blockers first', step: 'check' },
    }
  }

  return {
    issueDate: input.issueDate,
    draftState: 'ready_to_check',
    blockers,
    warnings,
    nextBestAction: warnings.length > 0
      ? `Draft has ${draft.articleCount} articles. Review ${warnings.length} warning${warnings.length === 1 ? '' : 's'} before publishing.`
      : `Draft has ${draft.articleCount} articles and no blockers.`,
    primaryAction: { label: warnings.length > 0 ? 'Review checks' : 'Publish issue', step: warnings.length > 0 ? 'check' : 'publish' },
  }
}
