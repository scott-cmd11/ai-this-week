import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/issue-date', () => ({
  issueDateFor: vi.fn(() => '2026-05-12'),
}))

vi.mock('@/lib/issue-store', () => ({
  captureArticleToTodaysDraft: vi.fn(),
  getIssueBlocks: vi.fn(),
  getIssueByDate: vi.fn(),
  getIssueById: vi.fn(),
  getIssueTargetByDate: vi.fn(),
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
  getArticleCandidateById: vi.fn(),
  updateArticleCandidate: vi.fn(),
}))

vi.mock('@/lib/known-urls', () => ({
  buildKnownTitleList: vi.fn(),
  buildKnownUrlMap: vi.fn(),
}))

const issueStore = await import('@/lib/issue-store')
const readiness = await import('@/lib/admin-issue-readiness')
const candidateStore = await import('@/lib/article-candidate-store')
const knownUrls = await import('@/lib/known-urls')

const cronRoute = await import('@/app/api/cron/daily-publish/route')
const importRoute = await import('@/app/api/import-briefing-articles/route')
const publishRoute = await import('@/app/api/publish-issue/route')
const candidateRoute = await import('@/app/api/article-candidates/[id]/route')
const { adminChecksFingerprint } = await import('@/lib/admin-readiness')
const { SHORT_ISSUE_CONFIRMATION } = await import('@/lib/publish-policy')

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

describe('publishing pipeline guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_PASSWORD = 'test-admin'
    process.env.CRON_SECRET = 'test-cron'
  })

  it('cron publish refuses a low-count issue with an explicit skipped reason', async () => {
    vi.mocked(issueStore.getIssueByDate).mockResolvedValue({
      id: 'issue-12',
      title: 'AI Today - May 12, 2026',
      issueDate: '2026-05-12',
      issueNumber: 12,
      published: false,
      summary: '',
      aiAssisted: true,
      slug: '2026-05-12',
    })
    vi.mocked(issueStore.getIssueBlocks).mockResolvedValue([])
    vi.mocked(readiness.getAdminRunSummaries).mockResolvedValue({
      candidates: { totalActive: 13, topPicks: 5, held: 0, rejected: 0, imported: 0, importedWithoutIssueContext: 0 },
      automation: { lastRunAt: null, sourceCount: 0, failureCount: 0 },
      candidateError: null,
    })
    vi.mocked(readiness.buildIssueReadiness).mockResolvedValue({
      articles: [],
      draftSummary: {
        exists: true,
        published: false,
        issueId: 'issue-12',
        issueNumber: 12,
        issueDate: '2026-05-12',
        articleCount: 2,
        sections: ['Canada'],
        missingSummaryCount: 0,
        missingTitleCount: 0,
        exactDuplicateUrlCount: 0,
        similarTopicCount: 0,
        staleSourceCount: 0,
        weakTitleCount: 0,
        missingImageCount: 0,
        brokenRequiredUrlCount: 0,
        publishReadinessFailed: false,
      },
      readiness: {
        issueDate: '2026-05-12',
        draftState: 'in_progress',
        blockers: [{ code: 'low_article_count', label: 'Very low article count', count: 1, severity: 'blocker' }],
        warnings: [],
        nextBestAction: 'Add more articles.',
        primaryAction: { label: 'Fix blockers first', step: 'check' },
      },
    })

    const response = await cronRoute.GET(new Request('https://example.test/api/cron/daily-publish', {
      headers: { authorization: 'Bearer test-cron' },
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      skipped: true,
      reason: 'low_article_count',
      articleCount: 2,
      minimumArticleCount: 5,
    })
    expect(issueStore.publishIssue).not.toHaveBeenCalled()
  })

  it('manual publish rejects a low-count issue unless the short-issue override is explicit', async () => {
    const lowCountBlocker = { code: 'low_article_count' as const, label: 'Very low article count', count: 1, severity: 'blocker' as const }
    vi.mocked(issueStore.getIssueById).mockResolvedValue({
      id: 'issue-12',
      title: 'AI Today - May 12, 2026',
      issueDate: '2026-05-12',
      issueNumber: 12,
      published: false,
      summary: '',
      aiAssisted: true,
      slug: '2026-05-12',
    })
    vi.mocked(issueStore.getIssueBlocks).mockResolvedValue([])
    vi.mocked(readiness.getAdminRunSummaries).mockResolvedValue({
      candidates: { totalActive: 13, topPicks: 5, held: 0, rejected: 0, imported: 0, importedWithoutIssueContext: 0 },
      automation: { lastRunAt: null, sourceCount: 0, failureCount: 0 },
      candidateError: null,
    })
    vi.mocked(readiness.buildIssueReadiness).mockResolvedValue({
      articles: [],
      draftSummary: {
        exists: true,
        published: false,
        issueId: 'issue-12',
        issueNumber: 12,
        issueDate: '2026-05-12',
        articleCount: 2,
        sections: ['Canada'],
        missingSummaryCount: 0,
        missingTitleCount: 0,
        exactDuplicateUrlCount: 0,
        similarTopicCount: 0,
        staleSourceCount: 0,
        weakTitleCount: 0,
        missingImageCount: 0,
        brokenRequiredUrlCount: 0,
        publishReadinessFailed: false,
      },
      readiness: {
        issueDate: '2026-05-12',
        draftState: 'in_progress',
        blockers: [lowCountBlocker],
        warnings: [],
        nextBestAction: 'Add more articles.',
        primaryAction: { label: 'Fix blockers first', step: 'check' },
      },
    })

    const rejected = await publishRoute.POST(jsonRequest('https://example.test/api/publish-issue', {
      password: 'test-admin',
      pageId: 'issue-12',
    }) as never)
    expect(rejected.status).toBe(409)
    expect(await rejected.json()).toMatchObject({
      shortIssueOverride: {
        requiredConfirmation: SHORT_ISSUE_CONFIRMATION,
        minimumArticleCount: 5,
      },
    })
    expect(issueStore.publishIssue).not.toHaveBeenCalled()

    vi.mocked(issueStore.publishIssue).mockResolvedValue({
      id: 'issue-12',
      title: 'AI Today - May 12, 2026',
      issueDate: '2026-05-12',
      issueNumber: 12,
      published: true,
      summary: '',
      aiAssisted: true,
      slug: '2026-05-12',
    })
    const accepted = await publishRoute.POST(jsonRequest('https://example.test/api/publish-issue', {
      password: 'test-admin',
      pageId: 'issue-12',
      checksFingerprint: adminChecksFingerprint([lowCountBlocker]),
      allowShortIssue: true,
      shortIssueConfirmation: SHORT_ISSUE_CONFIRMATION,
    }) as never)
    const acceptedBody = await accepted.json()

    expect(accepted.status).toBe(200)
    expect(acceptedBody.ok).toBe(true)
    expect(issueStore.publishIssue).toHaveBeenCalledWith('issue-12', expect.any(Object))
  })

  it('candidate import rejects draft import after today has already been published', async () => {
    vi.mocked(issueStore.getIssueTargetByDate).mockResolvedValue({
      issueId: 'issue-12',
      issueNumber: 12,
      issueDate: '2026-05-12',
      title: 'AI Today - May 12, 2026',
      published: true,
    })

    const response = await importRoute.POST(jsonRequest('https://example.test/api/import-briefing-articles', {
      adminPassword: 'test-admin',
      rewriteWithAi: false,
      articles: [{ title: 'Extra article', url: 'https://example.com/extra', summary: 'Summary.' }],
    }) as never)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('today_issue_already_published')
    expect(body.message).toContain('Use Issue Desk or Add to Issue')
    expect(issueStore.captureArticleToTodaysDraft).not.toHaveBeenCalled()
  })

  it('candidate status cannot be marked imported without a matching issue URL', async () => {
    vi.mocked(candidateStore.getArticleCandidateById).mockResolvedValue({
      id: 'candidate-1',
      title: 'Candidate',
      url: 'https://example.com/story',
      canonicalUrl: 'https://example.com/story',
      summary: '',
      source: 'Google Alerts Current RSS',
      sourceType: 'google_alerts',
      publishedAt: null,
      category: 'Canada',
      status: 'new',
      score: 80,
      scoreReasons: [],
      reviewedAt: null,
      importedAt: null,
      importedIssue: null,
      createdAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-12T00:00:00.000Z',
      rejectionReason: null,
    })
    vi.mocked(knownUrls.buildKnownUrlMap).mockResolvedValue(new Map())

    const response = await candidateRoute.PATCH(
      jsonRequest('https://example.test/api/article-candidates/candidate-1', {
        adminPassword: 'test-admin',
        status: 'imported',
        importedIssueId: 'issue-12',
        importedIssueDate: '2026-05-12',
      }) as never,
      { params: Promise.resolve({ id: 'candidate-1' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('cannot be marked imported')
    expect(candidateStore.updateArticleCandidate).not.toHaveBeenCalled()
  })

  it('candidate status can be marked imported when the URL is found in the intended issue', async () => {
    const candidate = {
      id: 'candidate-1',
      title: 'Candidate',
      url: 'https://example.com/story',
      canonicalUrl: 'https://example.com/story',
      summary: '',
      source: 'Google Alerts Current RSS',
      sourceType: 'google_alerts' as const,
      publishedAt: null,
      category: 'Canada' as const,
      status: 'new' as const,
      score: 80,
      scoreReasons: [],
      reviewedAt: null,
      importedAt: null,
      importedIssue: null,
      createdAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-12T00:00:00.000Z',
      rejectionReason: null,
    }
    vi.mocked(candidateStore.getArticleCandidateById).mockResolvedValue(candidate)
    vi.mocked(knownUrls.buildKnownUrlMap).mockResolvedValue(new Map([
      ['https://example.com/story', {
        pageId: 'issue-12',
        issueNumber: 12,
        issueDate: '2026-05-12',
        published: false,
        title: 'AI Today - May 12, 2026',
        url: 'https://example.com/story',
      }],
    ]))
    vi.mocked(candidateStore.updateArticleCandidate).mockResolvedValue({
      ...candidate,
      status: 'imported',
      reviewedAt: '2026-05-12T12:00:00.000Z',
      importedAt: '2026-05-12T12:00:00.000Z',
      updatedAt: '2026-05-12T12:00:00.000Z',
    })

    const response = await candidateRoute.PATCH(
      jsonRequest('https://example.test/api/article-candidates/candidate-1', {
        adminPassword: 'test-admin',
        status: 'imported',
        importedIssueId: 'issue-12',
        importedIssueDate: '2026-05-12',
      }) as never,
      { params: Promise.resolve({ id: 'candidate-1' }) },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.candidate.status).toBe('imported')
    expect(candidateStore.updateArticleCandidate).toHaveBeenCalledWith('candidate-1', expect.objectContaining({
      status: 'imported',
    }))
  })
})
