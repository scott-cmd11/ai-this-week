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
  ])

  const warnings = compact([
    item('similar_topic', 'Similar topic from recent issue', draft.similarTopicCount, 'warning'),
    item('stale_source', 'Older or stale source date', draft.staleSourceCount, 'warning'),
    item('weak_title', 'Weak title', draft.weakTitleCount, 'warning'),
    item('missing_image', 'Missing image', draft.missingImageCount, 'warning'),
    item('uneven_sections', 'Uneven section balance', hasUnevenSections(draft) ? 1 : 0, 'warning'),
    item('held_candidates', 'Held candidates still unresolved', candidates.held, 'warning'),
    item('low_article_count', 'Very low article count', draft.exists && draft.articleCount > 0 && draft.articleCount < 5 ? 1 : 0, 'warning'),
    item('automation_failure', 'Automation source failure', automation.failureCount, 'warning'),
  ])

  if (draft.published) {
    return {
      issueDate: input.issueDate,
      draftState: 'published',
      blockers: [],
      warnings,
      nextBestAction: 'Issue is published. Use Issue Desk for corrections.',
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
        : 'No draft exists yet. Check automation status before starting.',
      primaryAction: { label: "Start today's issue", step: candidates.totalActive > 0 ? 'choose' : 'intake' },
    }
  }

  if (blockers.length > 0) {
    return {
      issueDate: input.issueDate,
      draftState: 'in_progress',
      blockers,
      warnings,
      nextBestAction: `Fix ${blockers.length} blocker${blockers.length === 1 ? '' : 's'} before publishing.`,
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
