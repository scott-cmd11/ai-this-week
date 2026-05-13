import { isLowArticleCount, MIN_DAILY_ISSUE_ARTICLES } from './publish-policy'

export type DailyRunStep = 'status' | 'intake' | 'choose' | 'edit' | 'check' | 'publish'

export type DraftState = 'not_started' | 'in_progress' | 'ready_to_check' | 'published'

export const EVENING_BRIEFING_READY_LABEL = '8:00 PM America/Winnipeg'
export const DAILY_CANDIDATE_TARGET = 35
export const DAILY_STRONG_CANDIDATE_TARGET = 8
export const DAILY_PUBLISH_ARTICLE_TARGET = 8

export type EveningBriefingState =
  | 'ready'
  | 'waiting'
  | 'stale'
  | 'low_volume'
  | 'published'
  | 'published_needs_repair'
  | 'source_error'

export interface AdminSourceBreakdownItem {
  name: string
  count: number
  newestAt: string | null
}

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
  totalVisible?: number
  latestCandidateAt?: string | null
  latestActiveCandidateAt?: string | null
  sourceBreakdown?: AdminSourceBreakdownItem[]
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

export interface AdminEveningBriefingSummary {
  readyAtLocal: string
  candidateTarget: number
  strongCandidateTarget: number
  publishArticleTarget: number
  minimumArticleCount: number
  state: EveningBriefingState
  headline: string
  explanation: string
  nextAction: string
  totalCandidatesSeen: number
  usableCandidateCount: number
  strongCandidateCount: number
  rejectedCandidateCount: number
  importedCandidateCount: number
  duplicateOrRejectedCount: number
  sourceCount: number
  sourceBreakdown: AdminSourceBreakdownItem[]
  latestCandidateAt: string | null
  latestCandidateLocalDate: string | null
  lowVolumeReasons: string[]
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

function fallbackTotalVisible(candidates: AdminCandidateSummary): number {
  return candidates.totalActive + candidates.held + candidates.rejected + candidates.imported
}

function localDateForIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Winnipeg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

export function buildEveningBriefingSummary(input: AdminReadinessInput): AdminEveningBriefingSummary {
  const { automation, candidates, draft, issueDate } = input
  const sourceBreakdown = candidates.sourceBreakdown ?? []
  const latestCandidateAt = candidates.latestCandidateAt ?? automation.lastRunAt
  const latestCandidateLocalDate = localDateForIso(latestCandidateAt)
  const usableCandidateCount = candidates.totalActive + candidates.held
  const totalCandidatesSeen = candidates.totalVisible ?? fallbackTotalVisible(candidates)
  const sourceCount = Math.max(automation.sourceCount, sourceBreakdown.length)
  const isStale = !!latestCandidateAt && latestCandidateLocalDate !== issueDate
  const hasAnyCandidateSignal = totalCandidatesSeen > 0 || !!latestCandidateAt
  const canAssembleTarget = draft.articleCount + usableCandidateCount >= DAILY_PUBLISH_ARTICLE_TARGET
  const candidateVolumeLow = usableCandidateCount < DAILY_CANDIDATE_TARGET
  const strongVolumeLow = candidates.topPicks < DAILY_STRONG_CANDIDATE_TARGET
  const lowVolumeReasons: string[] = []

  if (automation.failureCount > 0) {
    lowVolumeReasons.push('A source or candidate-store check failed.')
  }
  if (!hasAnyCandidateSignal) {
    lowVolumeReasons.push('No candidate run has been detected yet.')
  }
  if (isStale && latestCandidateLocalDate) {
    lowVolumeReasons.push(`Latest candidate run appears to belong to ${latestCandidateLocalDate}, not ${issueDate}.`)
  }
  if (candidateVolumeLow) {
    lowVolumeReasons.push(`${usableCandidateCount} usable candidates are available; target is ${DAILY_CANDIDATE_TARGET}.`)
  }
  if (strongVolumeLow) {
    lowVolumeReasons.push(`${candidates.topPicks} strong candidates are available; target is ${DAILY_STRONG_CANDIDATE_TARGET}.`)
  }
  if (sourceCount <= 1 && hasAnyCandidateSignal) {
    lowVolumeReasons.push(`${sourceCount} source is represented; a normal evening should have several sources.`)
  }

  if (automation.failureCount > 0) {
    return {
      readyAtLocal: EVENING_BRIEFING_READY_LABEL,
      candidateTarget: DAILY_CANDIDATE_TARGET,
      strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
      publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
      minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
      state: 'source_error',
      headline: 'Source intake needs attention',
      explanation: 'The desk could not complete its source-health check. Review the source tools before publishing.',
      nextAction: 'Open Tools, check the source/import panel, then refresh this desk.',
      totalCandidatesSeen,
      usableCandidateCount,
      strongCandidateCount: candidates.topPicks,
      rejectedCandidateCount: candidates.rejected,
      importedCandidateCount: candidates.imported,
      duplicateOrRejectedCount: candidates.rejected,
      sourceCount,
      sourceBreakdown,
      latestCandidateAt: latestCandidateAt ?? null,
      latestCandidateLocalDate,
      lowVolumeReasons,
    }
  }

  if (draft.published) {
    const needsRepair = isLowArticleCount(draft.articleCount) || candidates.totalActive > 0
    return {
      readyAtLocal: EVENING_BRIEFING_READY_LABEL,
      candidateTarget: DAILY_CANDIDATE_TARGET,
      strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
      publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
      minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
      state: needsRepair ? 'published_needs_repair' : 'published',
      headline: needsRepair ? 'Published issue may need repair' : 'Published issue is live',
      explanation: needsRepair
        ? `This issue is live with ${draft.articleCount} articles and ${candidates.totalActive} active candidates still available.`
        : `This issue is live with ${draft.articleCount} articles.`,
      nextAction: needsRepair
        ? 'Open Issue Desk to append, edit, remove, or add a correction note.'
        : 'Use Issue Desk only if a correction or extra article is needed.',
      totalCandidatesSeen,
      usableCandidateCount,
      strongCandidateCount: candidates.topPicks,
      rejectedCandidateCount: candidates.rejected,
      importedCandidateCount: candidates.imported,
      duplicateOrRejectedCount: candidates.rejected,
      sourceCount,
      sourceBreakdown,
      latestCandidateAt: latestCandidateAt ?? null,
      latestCandidateLocalDate,
      lowVolumeReasons,
    }
  }

  if (!hasAnyCandidateSignal) {
    return {
      readyAtLocal: EVENING_BRIEFING_READY_LABEL,
      candidateTarget: DAILY_CANDIDATE_TARGET,
      strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
      publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
      minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
      state: 'waiting',
      headline: 'Waiting for tonight\'s candidate run',
      explanation: `The desk has not seen candidates for ${issueDate} yet. The briefing target is ${EVENING_BRIEFING_READY_LABEL}.`,
      nextAction: 'Refresh after the evening source run or open Tools for a manual source check.',
      totalCandidatesSeen,
      usableCandidateCount,
      strongCandidateCount: candidates.topPicks,
      rejectedCandidateCount: candidates.rejected,
      importedCandidateCount: candidates.imported,
      duplicateOrRejectedCount: candidates.rejected,
      sourceCount,
      sourceBreakdown,
      latestCandidateAt: null,
      latestCandidateLocalDate,
      lowVolumeReasons,
    }
  }

  if (isStale) {
    return {
      readyAtLocal: EVENING_BRIEFING_READY_LABEL,
      candidateTarget: DAILY_CANDIDATE_TARGET,
      strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
      publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
      minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
      state: 'stale',
      headline: 'Candidate run looks stale',
      explanation: latestCandidateLocalDate
        ? `The newest candidate activity appears to belong to ${latestCandidateLocalDate}, not ${issueDate}.`
        : 'The newest candidate activity could not be dated in Winnipeg time.',
      nextAction: 'Run or retry source intake before assembling tonight\'s issue.',
      totalCandidatesSeen,
      usableCandidateCount,
      strongCandidateCount: candidates.topPicks,
      rejectedCandidateCount: candidates.rejected,
      importedCandidateCount: candidates.imported,
      duplicateOrRejectedCount: candidates.rejected,
      sourceCount,
      sourceBreakdown,
      latestCandidateAt: latestCandidateAt ?? null,
      latestCandidateLocalDate,
      lowVolumeReasons,
    }
  }

  if ((candidateVolumeLow || strongVolumeLow) && !canAssembleTarget) {
    return {
      readyAtLocal: EVENING_BRIEFING_READY_LABEL,
      candidateTarget: DAILY_CANDIDATE_TARGET,
      strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
      publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
      minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
      state: 'low_volume',
      headline: 'Candidate volume is low',
      explanation: `Tonight has ${usableCandidateCount} usable candidates and ${draft.articleCount} draft articles. That is below the normal evening target.`,
      nextAction: 'Review candidates, retry source intake if needed, or use the intentional short-issue override only after editorial review.',
      totalCandidatesSeen,
      usableCandidateCount,
      strongCandidateCount: candidates.topPicks,
      rejectedCandidateCount: candidates.rejected,
      importedCandidateCount: candidates.imported,
      duplicateOrRejectedCount: candidates.rejected,
      sourceCount,
      sourceBreakdown,
      latestCandidateAt: latestCandidateAt ?? null,
      latestCandidateLocalDate,
      lowVolumeReasons,
    }
  }

  return {
    readyAtLocal: EVENING_BRIEFING_READY_LABEL,
    candidateTarget: DAILY_CANDIDATE_TARGET,
    strongCandidateTarget: DAILY_STRONG_CANDIDATE_TARGET,
    publishArticleTarget: DAILY_PUBLISH_ARTICLE_TARGET,
    minimumArticleCount: MIN_DAILY_ISSUE_ARTICLES,
    state: 'ready',
    headline: 'Tonight\'s briefing is ready to edit',
    explanation: `The desk has ${usableCandidateCount} usable candidates, ${candidates.topPicks} strong candidates, and ${draft.articleCount} draft articles.`,
    nextAction: 'Review candidates, edit the draft, then run publish checks.',
    totalCandidatesSeen,
    usableCandidateCount,
    strongCandidateCount: candidates.topPicks,
    rejectedCandidateCount: candidates.rejected,
    importedCandidateCount: candidates.imported,
    duplicateOrRejectedCount: candidates.rejected,
    sourceCount,
    sourceBreakdown,
    latestCandidateAt: latestCandidateAt ?? null,
    latestCandidateLocalDate,
    lowVolumeReasons,
  }
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
