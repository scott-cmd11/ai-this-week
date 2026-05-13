import { describe, expect, it } from 'vitest'
import {
  buildPublishingPreflight,
  buildPublishingWorkflowGuard,
  REQUIRED_PUBLISHING_WORKFLOWS,
} from '@/lib/publishing-preflight'
import { buildAdminReadiness, buildEveningBriefingSummary, type AdminCandidateSummary, type AdminDraftSummary } from '@/lib/admin-readiness'

const requiredWorkflow = REQUIRED_PUBLISHING_WORKFLOWS[0]

function workflowGuardOk() {
  return buildPublishingWorkflowGuard({
    localWorkflowPaths: [requiredWorkflow.path],
    defaultBranchWorkflowPaths: [requiredWorkflow.path, '.github/workflows/daily-briefing.yml'],
    activeWorkflowNames: [requiredWorkflow.name, 'Daily AI Briefing'],
    defaultBranchName: 'main',
  })
}

function draft(overrides: Partial<AdminDraftSummary> = {}): AdminDraftSummary {
  return {
    exists: true,
    published: false,
    issueId: 'issue-12',
    issueNumber: 12,
    issueDate: '2026-05-12',
    articleCount: 8,
    sections: ['Canada', 'Research', 'Policy'],
    missingSummaryCount: 0,
    missingTitleCount: 0,
    exactDuplicateUrlCount: 0,
    similarTopicCount: 0,
    staleSourceCount: 0,
    weakTitleCount: 0,
    missingImageCount: 0,
    brokenRequiredUrlCount: 0,
    publishReadinessFailed: false,
    ...overrides,
  }
}

function candidates(overrides: Partial<AdminCandidateSummary> = {}): AdminCandidateSummary {
  return {
    totalActive: 40,
    topPicks: 12,
    held: 0,
    rejected: 4,
    imported: 8,
    importedWithoutIssueContext: 0,
    totalVisible: 52,
    latestCandidateAt: '2026-05-13T00:30:00.000Z',
    latestActiveCandidateAt: '2026-05-13T00:30:00.000Z',
    sourceBreakdown: [
      { name: 'Google Alerts Current RSS', count: 24, newestAt: '2026-05-13T00:30:00.000Z' },
      { name: 'Daily AI Briefing', count: 16, newestAt: '2026-05-12T23:20:00.000Z' },
    ],
    ...overrides,
  }
}

function preflightInput({
  draftSummary = draft(),
  candidateSummary = candidates(),
  workflowGuard = workflowGuardOk(),
}: {
  draftSummary?: AdminDraftSummary
  candidateSummary?: AdminCandidateSummary
  workflowGuard?: ReturnType<typeof buildPublishingWorkflowGuard> | null
} = {}) {
  const issueDate = '2026-05-12'
  const automation = {
    lastRunAt: candidateSummary.latestCandidateAt ?? null,
    sourceCount: candidateSummary.sourceBreakdown?.length ?? 0,
    failureCount: 0,
  }
  const input = {
    issueDate,
    automation,
    candidates: candidateSummary,
    draft: draftSummary,
  }
  return {
    issueDate,
    automation,
    candidates: candidateSummary,
    draft: draftSummary,
    readiness: buildAdminReadiness(input),
    eveningBriefing: buildEveningBriefingSummary(input),
    workflowGuard,
  }
}

describe('publishing preflight', () => {
  it('fails when a required scheduled workflow exists locally but is missing from the default branch', () => {
    const guard = buildPublishingWorkflowGuard({
      localWorkflowPaths: [requiredWorkflow.path, '.github/workflows/daily-briefing.yml'],
      defaultBranchWorkflowPaths: ['.github/workflows/daily-briefing.yml'],
      activeWorkflowNames: ['Daily AI Briefing'],
      defaultBranchName: 'main',
    })

    expect(guard.ok).toBe(false)
    expect(guard.checks[0]).toMatchObject({
      status: 'fail',
      presentLocally: true,
      presentOnDefaultBranch: false,
      activeOnDefaultBranch: false,
    })
    expect(guard.checks[0].nextAction).toContain('default branch')
  })

  it('blocks publishing when the evening candidate run is stale in Winnipeg time', () => {
    const staleCandidates = candidates({
      latestCandidateAt: '2026-05-12T02:30:00.000Z',
      latestActiveCandidateAt: '2026-05-12T02:30:00.000Z',
      sourceBreakdown: [
        { name: 'Google Alerts Current RSS', count: 40, newestAt: '2026-05-12T02:30:00.000Z' },
      ],
    })

    const preflight = buildPublishingPreflight(preflightInput({ candidateSummary: staleCandidates }))

    expect(preflight.state).toBe('blocked')
    expect(preflight.publishable).toBe(false)
    expect(preflight.checks).toContainEqual(expect.objectContaining({
      code: 'source_freshness',
      status: 'fail',
    }))
  })

  it('holds a low-volume evening instead of letting it look ready', () => {
    const lowVolume = candidates({
      totalActive: 3,
      topPicks: 1,
      imported: 0,
      rejected: 0,
      totalVisible: 3,
      latestCandidateAt: '2026-05-13T00:30:00.000Z',
      sourceBreakdown: [
        { name: 'Google Alerts Current RSS', count: 3, newestAt: '2026-05-13T00:30:00.000Z' },
      ],
    })

    const preflight = buildPublishingPreflight(preflightInput({
      candidateSummary: lowVolume,
      draftSummary: draft({ articleCount: 2, sections: ['Canada'] }),
    }))

    expect(preflight.state).toBe('blocked')
    expect(preflight.checks).toContainEqual(expect.objectContaining({
      code: 'candidate_volume',
      status: 'fail',
    }))
    expect(preflight.nextAction).toMatch(/default branch|Retry source intake|Add more candidates|explicit short-issue override/i)
  })

  it('marks an already-published thin issue with active candidates as repair work', () => {
    const preflight = buildPublishingPreflight(preflightInput({
      draftSummary: draft({ published: true, articleCount: 2, sections: ['Canada'] }),
      candidateSummary: candidates({ totalActive: 13, topPicks: 5 }),
    }))

    expect(preflight.state).toBe('repair')
    expect(preflight.publishable).toBe(false)
    expect(preflight.checks).toContainEqual(expect.objectContaining({
      code: 'published_repair',
      status: 'warn',
    }))
  })

  it('is ready only when workflow, source freshness, candidate volume, and publish gates are healthy', () => {
    const preflight = buildPublishingPreflight(preflightInput())

    expect(preflight.state).toBe('ready')
    expect(preflight.publishable).toBe(true)
    expect(preflight.checks.every(check => check.status === 'pass')).toBe(true)
  })
})
