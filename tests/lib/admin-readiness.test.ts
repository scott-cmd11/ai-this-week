import { describe, expect, it } from 'vitest'
import {
  buildAdminReadiness,
  type AdminCandidateSummary,
  type AdminDraftSummary,
} from '@/lib/admin-readiness'

function candidates(overrides: Partial<AdminCandidateSummary> = {}): AdminCandidateSummary {
  return {
    totalActive: 12,
    topPicks: 5,
    held: 2,
    rejected: 3,
    imported: 4,
    ...overrides,
  }
}

function draft(overrides: Partial<AdminDraftSummary> = {}): AdminDraftSummary {
  return {
    exists: true,
    published: false,
    issueId: 'issue-2026-05-09',
    issueNumber: 9,
    issueDate: '2026-05-09',
    articleCount: 8,
    sections: ['Canada', 'Policy & Regulation', 'Industry & Models'],
    missingSummaryCount: 0,
    missingTitleCount: 0,
    exactDuplicateUrlCount: 0,
    similarTopicCount: 1,
    staleSourceCount: 1,
    weakTitleCount: 0,
    missingImageCount: 2,
    brokenRequiredUrlCount: 0,
    publishReadinessFailed: false,
    ...overrides,
  }
}

describe('buildAdminReadiness', () => {
  it('starts with candidate review when no draft exists and candidates are waiting', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 47 }),
      draft: draft({ exists: false, articleCount: 0, issueId: null }),
    })

    expect(result.draftState).toBe('not_started')
    expect(result.primaryAction.label).toBe("Start today's issue")
    expect(result.primaryAction.step).toBe('choose')
    expect(result.nextBestAction).toBe("Review 47 candidates from today's automations.")
  })

  it('blocks publishing when the draft has required data problems', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: null, sourceCount: 0, failureCount: 1 },
      candidates: candidates({ totalActive: 0 }),
      draft: draft({ missingSummaryCount: 2, exactDuplicateUrlCount: 1 }),
    })

    expect(result.draftState).toBe('in_progress')
    expect(result.blockers.map(item => item.code)).toEqual(['exact_duplicate_url', 'missing_summary'])
    expect(result.primaryAction.label).toBe('Fix blockers first')
    expect(result.primaryAction.step).toBe('check')
  })

  it('marks a draft ready to check when it only has warnings', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ held: 1 }),
      draft: draft({ similarTopicCount: 2, staleSourceCount: 1 }),
    })

    expect(result.draftState).toBe('ready_to_check')
    expect(result.blockers).toHaveLength(0)
    expect(result.warnings.map(item => item.code)).toContain('similar_topic')
    expect(result.warnings.map(item => item.code)).toContain('held_candidates')
    expect(result.primaryAction.label).toBe('Review checks')
  })

  it('points to the public issue after publication', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 0 }),
      draft: draft({ published: true, articleCount: 10 }),
    })

    expect(result.draftState).toBe('published')
    expect(result.primaryAction.label).toBe('View published issue')
    expect(result.primaryAction.href).toBe('/issues/2026-05-09')
  })
})
