import { describe, expect, it } from 'vitest'
import type { AdminDraftSummary, AdminEveningBriefingSummary, AdminReadiness } from '@/lib/admin-readiness'
import { evaluateAutopublishDecision } from '@/lib/autopublish-policy'

function draft(overrides: Partial<AdminDraftSummary> = {}): AdminDraftSummary {
  return {
    exists: true,
    published: false,
    issueId: 'issue-1',
    issueNumber: 1,
    issueDate: '2026-05-14',
    articleCount: 8,
    sections: ['Canada', 'Policy & Regulation', 'Research'],
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

function readiness(overrides: Partial<AdminReadiness> = {}): AdminReadiness {
  return {
    issueDate: '2026-05-14',
    draftState: 'ready_to_check',
    blockers: [],
    warnings: [],
    nextBestAction: 'Publish issue.',
    primaryAction: { label: 'Publish issue', step: 'publish' },
    ...overrides,
  }
}

function evening(overrides: Partial<AdminEveningBriefingSummary> = {}): AdminEveningBriefingSummary {
  return {
    readyAtLocal: '8:00 PM America/Winnipeg',
    candidateTarget: 35,
    strongCandidateTarget: 8,
    publishArticleTarget: 8,
    minimumArticleCount: 5,
    state: 'ready',
    headline: 'Tonight is ready',
    explanation: 'The briefing is ready.',
    nextAction: 'Publish.',
    totalCandidatesSeen: 40,
    usableCandidateCount: 35,
    strongCandidateCount: 10,
    rejectedCandidateCount: 0,
    importedCandidateCount: 0,
    duplicateOrRejectedCount: 0,
    sourceCount: 3,
    sourceBreakdown: [],
    latestCandidateAt: '2026-05-15T00:30:00.000Z',
    latestCandidateLocalDate: '2026-05-14',
    lowVolumeReasons: [],
    ...overrides,
  }
}

describe('evaluateAutopublishDecision', () => {
  it('allows a healthy issue even when only autopilot-safe polish warnings remain', () => {
    const decision = evaluateAutopublishDecision({
      draft: draft(),
      readiness: readiness({
        warnings: [
          { code: 'missing_image', label: 'Missing image', count: 2, severity: 'warning' },
          { code: 'uneven_sections', label: 'Uneven section balance', count: 1, severity: 'warning' },
        ],
      }),
      eveningBriefing: evening(),
    })

    expect(decision.publishable).toBe(true)
    expect(decision.reason).toBe('ready')
    expect(decision.toleratedWarnings).toHaveLength(2)
  })

  it('blocks stale source runs even when the draft has enough articles', () => {
    const decision = evaluateAutopublishDecision({
      draft: draft(),
      readiness: readiness(),
      eveningBriefing: evening({ state: 'stale', latestCandidateLocalDate: '2026-05-13' }),
    })

    expect(decision.publishable).toBe(false)
    expect(decision.reason).toBe('source_freshness')
  })

  it('blocks drafts below the minimum article count', () => {
    const decision = evaluateAutopublishDecision({
      draft: draft({ articleCount: 4 }),
      readiness: readiness({
        blockers: [{ code: 'low_article_count', label: 'Very low article count', count: 1, severity: 'blocker' }],
      }),
      eveningBriefing: evening(),
    })

    expect(decision.publishable).toBe(false)
    expect(decision.reason).toBe('low_article_count')
    expect(decision.minimumArticleCount).toBe(5)
  })

  it('can publish above the minimum when volume is low but the issue is otherwise healthy', () => {
    const decision = evaluateAutopublishDecision({
      draft: draft({ articleCount: 6 }),
      readiness: readiness(),
      eveningBriefing: evening({
        state: 'low_volume',
        usableCandidateCount: 6,
        strongCandidateCount: 4,
        lowVolumeReasons: ['6 usable candidates are available; target is 35.'],
      }),
    })

    expect(decision.publishable).toBe(true)
    expect(decision.reason).toBe('ready')
    expect(decision.notes.join(' ')).toContain('Candidate volume is low')
  })

  it('blocks public-quality warnings that need editor review', () => {
    const decision = evaluateAutopublishDecision({
      draft: draft(),
      readiness: readiness({
        warnings: [
          { code: 'weak_title', label: 'Weak title', count: 1, severity: 'warning' },
        ],
      }),
      eveningBriefing: evening(),
    })

    expect(decision.publishable).toBe(false)
    expect(decision.reason).toBe('publish_readiness')
    expect(decision.blockingWarnings[0]?.code).toBe('weak_title')
  })
})
