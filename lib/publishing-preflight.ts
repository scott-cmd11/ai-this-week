import type {
  AdminAutomationSummary,
  AdminCandidateSummary,
  AdminDraftSummary,
  AdminEveningBriefingSummary,
  AdminReadiness,
} from './admin-readiness'

export type PublishingPreflightState = 'ready' | 'hold' | 'repair' | 'blocked'
export type PublishingPreflightCheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface RequiredPublishingWorkflow {
  path: string
  name: string
  purpose: string
}

export const REQUIRED_PUBLISHING_WORKFLOWS: RequiredPublishingWorkflow[] = [
  {
    path: '.github/workflows/evening-google-alerts-candidates.yml',
    name: 'Evening Google Alerts Candidate Import',
    purpose: '7:15 PM Winnipeg candidate intake from Google Alerts/RSS.',
  },
]

export interface PublishingWorkflowGuardCheck extends RequiredPublishingWorkflow {
  status: PublishingPreflightCheckStatus
  presentLocally: boolean
  presentOnDefaultBranch: boolean | null
  activeOnDefaultBranch: boolean | null
  detail: string
  nextAction: string
}

export interface PublishingWorkflowGuard {
  defaultBranchName: string | null
  ok: boolean
  checks: PublishingWorkflowGuardCheck[]
  blockers: string[]
  warnings: string[]
}

export interface PublishingWorkflowGuardInput {
  localWorkflowPaths: string[]
  defaultBranchWorkflowPaths?: string[] | null
  activeWorkflowNames?: string[] | null
  defaultBranchName?: string | null
}

export interface PublishingPreflightCheck {
  code:
    | 'default_branch_workflow'
    | 'source_freshness'
    | 'candidate_volume'
    | 'draft_publish_gate'
    | 'published_repair'
    | 'candidate_traceability'
  label: string
  status: PublishingPreflightCheckStatus
  detail: string
  nextAction: string
}

export interface PublishingPreflightInput {
  issueDate: string
  automation: AdminAutomationSummary
  candidates: AdminCandidateSummary
  draft: AdminDraftSummary
  readiness: AdminReadiness
  eveningBriefing: AdminEveningBriefingSummary
  workflowGuard?: PublishingWorkflowGuard | null
}

export interface PublishingPreflightSummary {
  issueDate: string
  state: PublishingPreflightState
  headline: string
  nextAction: string
  checks: PublishingPreflightCheck[]
  sourceJobsActive: boolean | null
  eveningRunDetectedToday: boolean
  publishable: boolean
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase()
}

function workflowNameMatches(activeName: string, workflow: RequiredPublishingWorkflow): boolean {
  const normalizedActive = activeName.trim().toLowerCase()
  const normalizedName = workflow.name.trim().toLowerCase()
  const fileName = workflow.path.split('/').pop()?.replace(/\.ya?ml$/i, '').toLowerCase() ?? ''
  return normalizedActive === normalizedName || normalizedActive.includes(normalizedName) || normalizedActive.includes(fileName)
}

export function buildPublishingWorkflowGuard(input: PublishingWorkflowGuardInput): PublishingWorkflowGuard {
  const localPaths = new Set(input.localWorkflowPaths.map(normalizePath))
  const defaultPaths = input.defaultBranchWorkflowPaths
    ? new Set(input.defaultBranchWorkflowPaths.map(normalizePath))
    : null
  const activeNames = input.activeWorkflowNames ?? null

  const checks = REQUIRED_PUBLISHING_WORKFLOWS.map(workflow => {
    const normalizedRequiredPath = normalizePath(workflow.path)
    const presentLocally = localPaths.has(normalizedRequiredPath)
    const presentOnDefaultBranch = defaultPaths ? defaultPaths.has(normalizedRequiredPath) : null
    const activeOnDefaultBranch = activeNames
      ? activeNames.some(name => workflowNameMatches(name, workflow))
      : null

    if (!presentLocally) {
      return {
        ...workflow,
        status: 'fail' as const,
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
        detail: `${workflow.path} is missing locally, so the evening source run is not protected by code review.`,
        nextAction: 'Restore the required workflow file before relying on scheduled candidate intake.',
      }
    }

    if (presentOnDefaultBranch === false) {
      return {
        ...workflow,
        status: 'fail' as const,
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
        detail: `${workflow.path} exists locally but is not present on ${input.defaultBranchName ?? 'the default branch'}.`,
        nextAction: 'Merge or cherry-pick the workflow onto the default branch before expecting the evening run to happen.',
      }
    }

    if (activeOnDefaultBranch === false) {
      return {
        ...workflow,
        status: 'fail' as const,
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
        detail: `${workflow.name} is present but not reported as an active GitHub workflow.`,
        nextAction: 'Enable the workflow in GitHub Actions or verify the default-branch workflow state.',
      }
    }

    if (presentOnDefaultBranch === null || activeOnDefaultBranch === null) {
      return {
        ...workflow,
        status: 'unknown' as const,
        presentLocally,
        presentOnDefaultBranch,
        activeOnDefaultBranch,
        detail: `${workflow.name} could not be verified against GitHub/default branch state.`,
        nextAction: 'Run the publishing preflight with GitHub CLI access before publishing.',
      }
    }

    return {
      ...workflow,
      status: 'pass' as const,
      presentLocally,
      presentOnDefaultBranch,
      activeOnDefaultBranch,
      detail: `${workflow.name} is present locally, present on ${input.defaultBranchName ?? 'the default branch'}, and active.`,
      nextAction: 'No workflow action needed.',
    }
  })

  const blockers = checks.filter(check => check.status === 'fail').map(check => check.detail)
  const warnings = checks.filter(check => check.status === 'unknown').map(check => check.detail)

  return {
    defaultBranchName: input.defaultBranchName ?? null,
    ok: blockers.length === 0,
    checks,
    blockers,
    warnings,
  }
}

function preflightCheck(
  code: PublishingPreflightCheck['code'],
  label: string,
  status: PublishingPreflightCheckStatus,
  detail: string,
  nextAction: string,
): PublishingPreflightCheck {
  return { code, label, status, detail, nextAction }
}

function stateFromChecks(input: PublishingPreflightInput, checks: PublishingPreflightCheck[]): PublishingPreflightState {
  if (input.draft.published && input.eveningBriefing.state === 'published_needs_repair') return 'repair'
  if (checks.some(check => check.status === 'fail')) return 'blocked'
  if (checks.some(check => check.status === 'warn' || check.status === 'unknown')) return 'hold'
  return 'ready'
}

function preflightCopy(state: PublishingPreflightState): { headline: string; fallbackAction: string } {
  if (state === 'ready') {
    return {
      headline: 'Publishing preflight is ready',
      fallbackAction: 'Review the issue one last time, then publish through the normal checklist.',
    }
  }
  if (state === 'repair') {
    return {
      headline: 'Published issue needs repair attention',
      fallbackAction: 'Open Issue Desk and append, edit, remove, or correct the live issue before calling the day complete.',
    }
  }
  if (state === 'blocked') {
    return {
      headline: 'Publishing preflight is blocked',
      fallbackAction: 'Fix the failed preflight checks before normal publishing.',
    }
  }
  return {
    headline: 'Publishing preflight says hold',
    fallbackAction: 'Resolve the warning checks or make a deliberate editorial decision before publishing.',
  }
}

export function buildPublishingPreflight(input: PublishingPreflightInput): PublishingPreflightSummary {
  const { candidates, draft, eveningBriefing, readiness, workflowGuard } = input
  const checks: PublishingPreflightCheck[] = []

  if (workflowGuard) {
    const failedWorkflow = workflowGuard.checks.find(check => check.status === 'fail')
    const unknownWorkflow = workflowGuard.checks.find(check => check.status === 'unknown' || check.status === 'warn')
    const firstWorkflow = failedWorkflow ?? unknownWorkflow ?? workflowGuard.checks[0]
    checks.push(preflightCheck(
      'default_branch_workflow',
      'Scheduled source workflow',
      failedWorkflow ? 'fail' : unknownWorkflow ? 'unknown' : 'pass',
      firstWorkflow?.detail ?? 'No required scheduled publishing workflows were configured.',
      firstWorkflow?.nextAction ?? 'Add a required workflow check before relying on source automation.',
    ))
  } else {
    checks.push(preflightCheck(
      'default_branch_workflow',
      'Scheduled source workflow',
      'unknown',
      'Default-branch GitHub workflow state has not been checked in this request.',
      'Run `npm run preflight:publishing` before publishing or after deploy.',
    ))
  }

  if (eveningBriefing.state === 'source_error') {
    checks.push(preflightCheck(
      'source_freshness',
      'Evening source run',
      'fail',
      'The candidate/source health check reported an error.',
      'Open Tools, retry or inspect source intake, then refresh the desk.',
    ))
  } else if (eveningBriefing.state === 'waiting') {
    checks.push(preflightCheck(
      'source_freshness',
      'Evening source run',
      'warn',
      `No candidate run has been detected for ${input.issueDate}.`,
      'Wait for the 8 PM Winnipeg briefing target or run a manual source check.',
    ))
  } else if (eveningBriefing.state === 'stale') {
    checks.push(preflightCheck(
      'source_freshness',
      'Evening source run',
      'fail',
      `Latest candidate activity belongs to ${eveningBriefing.latestCandidateLocalDate ?? 'an unknown local date'}, not ${input.issueDate}.`,
      'Retry source intake before publishing tonight\'s issue.',
    ))
  } else {
    checks.push(preflightCheck(
      'source_freshness',
      'Evening source run',
      'pass',
      eveningBriefing.latestCandidateAt
        ? `Latest candidate activity is visible for ${eveningBriefing.latestCandidateLocalDate ?? 'today'}.`
        : 'Source freshness is acceptable for the current issue state.',
      'No source freshness action needed.',
    ))
  }

  if (eveningBriefing.state === 'low_volume') {
    checks.push(preflightCheck(
      'candidate_volume',
      'Candidate volume',
      'fail',
      `${eveningBriefing.usableCandidateCount} usable candidates and ${eveningBriefing.strongCandidateCount} strong candidates are below the normal evening target.`,
      'Retry source intake, add selected candidates, or use a deliberate short-issue override only after editorial review.',
    ))
  } else if (eveningBriefing.usableCandidateCount < eveningBriefing.candidateTarget || eveningBriefing.strongCandidateCount < eveningBriefing.strongCandidateTarget) {
    checks.push(preflightCheck(
      'candidate_volume',
      'Candidate volume',
      'warn',
      `${eveningBriefing.usableCandidateCount}/${eveningBriefing.candidateTarget} usable candidates and ${eveningBriefing.strongCandidateCount}/${eveningBriefing.strongCandidateTarget} strong candidates are visible.`,
      'Confirm the draft is still strong enough before publishing.',
    ))
  } else {
    checks.push(preflightCheck(
      'candidate_volume',
      'Candidate volume',
      'pass',
      `${eveningBriefing.usableCandidateCount} usable candidates and ${eveningBriefing.strongCandidateCount} strong candidates are visible.`,
      'No candidate-volume action needed.',
    ))
  }

  if (draft.published) {
    checks.push(preflightCheck(
      'draft_publish_gate',
      'Draft publish gate',
      'pass',
      `Issue #${draft.issueNumber ?? 'unknown'} is already published with ${draft.articleCount} articles.`,
      'Use Issue Desk only for repair, correction, or additional coverage.',
    ))
  } else if (readiness.blockers.length > 0) {
    checks.push(preflightCheck(
      'draft_publish_gate',
      'Draft publish gate',
      'fail',
      `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'} must be fixed before normal publishing.`,
      readiness.nextBestAction,
    ))
  } else if (readiness.warnings.length > 0) {
    checks.push(preflightCheck(
      'draft_publish_gate',
      'Draft publish gate',
      'warn',
      `${readiness.warnings.length} warning${readiness.warnings.length === 1 ? '' : 's'} should be reviewed before publishing.`,
      readiness.nextBestAction,
    ))
  } else {
    checks.push(preflightCheck(
      'draft_publish_gate',
      'Draft publish gate',
      'pass',
      `Draft has ${draft.articleCount} articles and no blockers.`,
      readiness.nextBestAction,
    ))
  }

  if (eveningBriefing.state === 'published_needs_repair') {
    checks.push(preflightCheck(
      'published_repair',
      'Published issue repair',
      'warn',
      `The live issue has ${draft.articleCount} articles while ${candidates.totalActive} active candidates remain.`,
      'Open Issue Desk and repair the live issue before treating the day as complete.',
    ))
  } else {
    checks.push(preflightCheck(
      'published_repair',
      'Published issue repair',
      'pass',
      draft.published ? 'Published issue does not show a low-count repair condition.' : 'Issue is not yet published.',
      draft.published ? 'No repair action needed.' : 'Continue normal draft assembly.',
    ))
  }

  if (candidates.importedWithoutIssueContext > 0) {
    checks.push(preflightCheck(
      'candidate_traceability',
      'Candidate traceability',
      'warn',
      `${candidates.importedWithoutIssueContext} imported candidate${candidates.importedWithoutIssueContext === 1 ? '' : 's'} could not be matched back to an issue/date.`,
      'Review imported candidates before relying on the inbox as source-of-truth.',
    ))
  } else {
    checks.push(preflightCheck(
      'candidate_traceability',
      'Candidate traceability',
      'pass',
      'Imported candidate state is traceable to issue/date context or no imported candidates need matching.',
      'No traceability action needed.',
    ))
  }

  const state = stateFromChecks(input, checks)
  const copy = preflightCopy(state)
  const firstActionable = checks.find(check => check.status === 'fail')
    ?? checks.find(check => check.status === 'warn' || check.status === 'unknown')

  return {
    issueDate: input.issueDate,
    state,
    headline: copy.headline,
    nextAction: firstActionable?.nextAction ?? copy.fallbackAction,
    checks,
    sourceJobsActive: workflowGuard ? workflowGuard.ok : null,
    eveningRunDetectedToday: eveningBriefing.latestCandidateLocalDate === input.issueDate,
    publishable: state === 'ready',
  }
}
