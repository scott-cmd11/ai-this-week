import { describe, expect, it } from 'vitest'
import {
  buildEveningBriefingSummary,
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
    importedWithoutIssueContext: 0,
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

  it('starts manual editing when no draft exists and no candidates are waiting', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 0 }),
      draft: draft({ exists: false, articleCount: 0, issueId: null }),
    })

    expect(result.draftState).toBe('not_started')
    expect(result.primaryAction.label).toBe("Start today's issue")
    expect(result.primaryAction.step).toBe('edit')
    expect(result.nextBestAction).toBe("No draft exists yet. Add an article or learning event to start today's issue.")
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

  it('blocks normal publishing when a draft has too few articles', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-09',
      automation: { lastRunAt: '2026-05-09T12:00:00.000Z', sourceCount: 4, failureCount: 0 },
      candidates: candidates({ totalActive: 9 }),
      draft: draft({ articleCount: 2, sections: ['Canada'], missingImageCount: 0, similarTopicCount: 0, staleSourceCount: 0 }),
    })

    expect(result.draftState).toBe('in_progress')
    expect(result.blockers.map(item => item.code)).toContain('low_article_count')
    expect(result.warnings.map(item => item.code)).not.toContain('low_article_count')
    expect(result.nextBestAction).toContain('explicit short-issue override')
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

  it('keeps a low-count published issue visible as a repair warning', () => {
    const result = buildAdminReadiness({
      issueDate: '2026-05-12',
      automation: { lastRunAt: null, sourceCount: 0, failureCount: 0 },
      candidates: candidates({ totalActive: 13, topPicks: 5, held: 0 }),
      draft: draft({
        published: true,
        issueDate: '2026-05-12',
        articleCount: 2,
        sections: ['Canada'],
        missingImageCount: 0,
        similarTopicCount: 0,
        staleSourceCount: 0,
      }),
    })

    expect(result.draftState).toBe('published')
    expect(result.blockers).toHaveLength(0)
    expect(result.warnings.map(item => item.code)).toEqual([
      'low_article_count',
      'active_candidates_after_publish',
    ])
    expect(result.nextBestAction).toContain('13 candidates remain active')
  })
})

describe('buildEveningBriefingSummary', () => {
  it('flags stale evening intake when the latest candidates belong to a prior Winnipeg date', () => {
    const result = buildEveningBriefingSummary({
      issueDate: '2026-05-12',
      automation: { lastRunAt: '2026-05-12T02:29:43.000Z', sourceCount: 1, failureCount: 0 },
      candidates: candidates({
        totalActive: 13,
        topPicks: 5,
        held: 0,
        rejected: 48,
        imported: 12,
        totalVisible: 73,
        latestCandidateAt: '2026-05-12T02:29:43.000Z',
        sourceBreakdown: [{ name: 'Google Alerts Current RSS', count: 73, newestAt: '2026-05-12T02:29:43.000Z' }],
      }),
      draft: draft({
        issueDate: '2026-05-12',
        articleCount: 2,
        sections: ['Canada'],
        missingImageCount: 0,
        similarTopicCount: 0,
        staleSourceCount: 0,
      }),
    })

    expect(result.state).toBe('stale')
    expect(result.latestCandidateLocalDate).toBe('2026-05-11')
    expect(result.lowVolumeReasons).toContain('13 usable candidates are available; target is 35.')
    expect(result.nextAction).toContain('source intake')
  })

  it('marks the evening desk ready when candidate volume and draft coverage are healthy', () => {
    const result = buildEveningBriefingSummary({
      issueDate: '2026-05-12',
      automation: { lastRunAt: '2026-05-12T20:30:00.000Z', sourceCount: 5, failureCount: 0 },
      candidates: candidates({
        totalActive: 42,
        topPicks: 12,
        held: 2,
        rejected: 18,
        imported: 6,
        totalVisible: 68,
        latestCandidateAt: '2026-05-12T20:30:00.000Z',
        sourceBreakdown: [
          { name: 'Google Alerts Current RSS', count: 35, newestAt: '2026-05-12T20:30:00.000Z' },
          { name: 'AI Voices', count: 12, newestAt: '2026-05-12T19:00:00.000Z' },
        ],
      }),
      draft: draft({ issueDate: '2026-05-12', articleCount: 8 }),
    })

    expect(result.state).toBe('ready')
    expect(result.usableCandidateCount).toBe(44)
    expect(result.sourceCount).toBe(5)
    expect(result.lowVolumeReasons).toHaveLength(0)
  })

  it('routes a low-count published issue to live repair instead of normal publish', () => {
    const result = buildEveningBriefingSummary({
      issueDate: '2026-05-12',
      automation: { lastRunAt: '2026-05-12T20:30:00.000Z', sourceCount: 2, failureCount: 0 },
      candidates: candidates({ totalActive: 13, topPicks: 5, held: 0 }),
      draft: draft({
        published: true,
        issueDate: '2026-05-12',
        articleCount: 2,
        sections: ['Canada'],
        missingImageCount: 0,
        similarTopicCount: 0,
        staleSourceCount: 0,
      }),
    })

    expect(result.state).toBe('published_needs_repair')
    expect(result.nextAction).toContain('Issue Desk')
  })
})
