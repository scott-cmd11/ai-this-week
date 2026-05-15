import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminDraftSummary, AdminEveningBriefingSummary, AdminReadiness } from '@/lib/admin-readiness'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/issue-date', () => ({
  issueDateFor: vi.fn(() => '2026-05-14'),
}))

vi.mock('@/lib/issue-store', () => ({
  getIssueBlocks: vi.fn(),
  getIssueByDate: vi.fn(),
  publishIssue: vi.fn(),
}))

vi.mock('@/lib/admin-issue-readiness', () => ({
  buildIssueReadiness: vi.fn(),
  getAdminRunSummaries: vi.fn(),
}))

vi.mock('@/lib/issue-publish-summary', () => ({
  buildIssuePublishSummary: vi.fn(),
}))

vi.mock('@/lib/article-candidate-store', () => ({
  isArticleCandidateStoreConfigured: vi.fn(),
  listArticleCandidates: vi.fn(),
}))

const issueStore = await import('@/lib/issue-store')
const adminIssueReadiness = await import('@/lib/admin-issue-readiness')
const issuePublishSummary = await import('@/lib/issue-publish-summary')
const candidateStore = await import('@/lib/article-candidate-store')
const autopublishRoute = await import('@/app/api/cron/autopublish/route')

const baseDraft = {
  id: 'issue-14',
  title: 'AI Today - May 14, 2026',
  issueDate: '2026-05-14',
  issueNumber: 14,
  published: false,
  summary: '',
  aiAssisted: true,
  slug: '2026-05-14',
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function runSummaries() {
  return {
    candidates: {
      totalActive: 40,
      topPicks: 12,
      held: 0,
      rejected: 4,
      imported: 8,
      importedWithoutIssueContext: 0,
      totalVisible: 52,
      latestCandidateAt: '2026-05-15T00:30:00.000Z',
      sourceBreakdown: [
        { name: 'Google Alerts Current RSS', count: 28, newestAt: '2026-05-15T00:30:00.000Z' },
      ],
    },
    automation: { lastRunAt: '2026-05-15T00:30:00.000Z', sourceCount: 1, failureCount: 0 },
    candidateError: null,
  }
}

function readinessResult({
  articleCount = 8,
  eveningState = 'ready',
  warnings = [],
  blockers = [],
  exists = true,
}: {
  articleCount?: number
  eveningState?: 'ready' | 'waiting' | 'stale' | 'low_volume'
  warnings?: Array<{ code: 'missing_image' | 'weak_title'; label: string; count: number; severity: 'warning' }>
  blockers?: Array<{ code: 'low_article_count'; label: string; count: number; severity: 'blocker' }>
  exists?: boolean
} = {}) {
  const draftSummary: AdminDraftSummary = {
    exists,
    published: false,
    issueId: exists ? 'issue-14' : null,
    issueNumber: exists ? 14 : null,
    issueDate: '2026-05-14',
    articleCount,
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
  }
  const readiness: AdminReadiness = {
    issueDate: '2026-05-14',
    draftState: exists ? 'ready_to_check' : 'not_started',
    blockers,
    warnings,
    nextBestAction: 'Publish issue.',
    primaryAction: { label: 'Publish issue', step: 'publish' },
  }
  const eveningBriefing: AdminEveningBriefingSummary = {
    readyAtLocal: '8:00 PM America/Winnipeg',
    candidateTarget: 35,
    strongCandidateTarget: 8,
    publishArticleTarget: 8,
    minimumArticleCount: 5,
    state: eveningState,
    headline: 'Tonight is ready',
    explanation: 'The briefing is ready.',
    nextAction: 'Publish.',
    totalCandidatesSeen: 40,
    usableCandidateCount: 35,
    strongCandidateCount: 10,
    rejectedCandidateCount: 0,
    importedCandidateCount: 0,
    duplicateOrRejectedCount: 0,
    sourceCount: 2,
    sourceBreakdown: [],
    latestCandidateAt: '2026-05-15T00:30:00.000Z',
    latestCandidateLocalDate: eveningState === 'stale' ? '2026-05-13' : '2026-05-14',
    lowVolumeReasons: [],
  }

  return {
    articles: [],
    draftSummary,
    readiness,
    eveningBriefing,
  }
}

describe('/api/cron/autopublish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_PASSWORD = 'test-admin'
    process.env.CRON_SECRET = 'test-cron'
    vi.mocked(adminIssueReadiness.getAdminRunSummaries).mockResolvedValue(runSummaries())
    vi.mocked(issueStore.getIssueBlocks).mockResolvedValue([])
    vi.mocked(candidateStore.isArticleCandidateStoreConfigured).mockReturnValue(false)
    vi.mocked(candidateStore.listArticleCandidates).mockResolvedValue([])
  })

  it('dry-runs assembly when no draft exists without publishing', async () => {
    vi.mocked(issueStore.getIssueByDate).mockResolvedValue(null)
    vi.mocked(adminIssueReadiness.buildIssueReadiness).mockResolvedValue(readinessResult({
      exists: false,
      articleCount: 0,
      eveningState: 'ready',
    }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: '2026-05-14',
      dryRun: true,
      parsed: 12,
      imported: 6,
      sources: [],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await autopublishRoute.POST(jsonRequest('https://example.test/api/cron/autopublish', {
      adminPassword: 'test-admin',
      dryRun: true,
      date: '2026-05-14',
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      dryRun: true,
      publishable: false,
      skipped: true,
      reason: 'no_draft',
      issueDate: '2026-05-14',
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"dryRun":true'),
    }))
    expect(issueStore.publishIssue).not.toHaveBeenCalled()
  })

  it('publishes a healthy draft with only autopilot-safe warnings', async () => {
    vi.mocked(issueStore.getIssueByDate).mockResolvedValue(baseDraft)
    vi.mocked(adminIssueReadiness.buildIssueReadiness).mockResolvedValue(readinessResult({
      articleCount: 8,
      warnings: [{ code: 'missing_image', label: 'Missing image', count: 2, severity: 'warning' }],
    }))
    vi.mocked(issuePublishSummary.buildIssuePublishSummary).mockResolvedValue('Daily summary.')
    vi.mocked(issueStore.publishIssue).mockResolvedValue({ ...baseDraft, published: true })

    const response = await autopublishRoute.GET(new Request('https://example.test/api/cron/autopublish', {
      headers: { authorization: 'Bearer test-cron' },
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      published: true,
      reason: 'ready',
      issueId: 'issue-14',
      articleCount: 8,
    })
    expect(issueStore.publishIssue).toHaveBeenCalledWith('issue-14', { summary: 'Daily summary.' })
  })

  it('refuses to publish when the evening source signal is stale', async () => {
    vi.mocked(issueStore.getIssueByDate).mockResolvedValue(baseDraft)
    vi.mocked(adminIssueReadiness.buildIssueReadiness).mockResolvedValue(readinessResult({
      articleCount: 8,
      eveningState: 'stale',
    }))

    const response = await autopublishRoute.GET(new Request('https://example.test/api/cron/autopublish', {
      headers: { authorization: 'Bearer test-cron' },
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      publishable: false,
      skipped: true,
      reason: 'source_freshness',
      articleCount: 8,
    })
    expect(issueStore.publishIssue).not.toHaveBeenCalled()
  })
})
