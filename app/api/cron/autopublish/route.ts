import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { DAILY_PUBLISH_ARTICLE_TARGET } from '@/lib/admin-readiness'
import { buildIssueReadiness, getAdminRunSummaries } from '@/lib/admin-issue-readiness'
import { evaluateAutopublishDecision } from '@/lib/autopublish-policy'
import type { ArticleCandidate } from '@/lib/article-candidates'
import { isArticleCandidateStoreConfigured, listArticleCandidates } from '@/lib/article-candidate-store'
import { issueDateFor } from '@/lib/issue-date'
import { getIssueBlocks, getIssueByDate, publishIssue } from '@/lib/issue-store'
import { buildIssuePublishSummary } from '@/lib/issue-publish-summary'
import { MIN_DAILY_ISSUE_ARTICLES } from '@/lib/publish-policy'

export const dynamic = 'force-dynamic'

const DEFAULT_MAX_CANDIDATE_IMPORTS = 12
const MIN_AUTOPUBLISH_CANDIDATE_SCORE = 70
const MANUAL_AUTOPUBLISH_CONFIRMATION = 'RUN AUTOPUBLISH'

interface AutopublishOperation {
  type: 'assemble' | 'candidate_import' | 'candidate_mark_imported' | 'publish'
  ok: boolean
  dryRun?: boolean
  detail: string
  status?: number
  body?: unknown
}

interface AutopublishRequestOptions {
  dryRun: boolean
  dateOverride?: string
  maxCandidateImports: number
  targetArticles: number
  minimumArticleCount: number
}

interface Snapshot {
  draft: Awaited<ReturnType<typeof getIssueByDate>>
  blocks: Awaited<ReturnType<typeof getIssueBlocks>>
  candidates: Awaited<ReturnType<typeof getAdminRunSummaries>>['candidates']
  automation: Awaited<ReturnType<typeof getAdminRunSummaries>>['automation']
  candidateError: string | null
  readiness: Awaited<ReturnType<typeof buildIssueReadiness>>['readiness']
  eveningBriefing: Awaited<ReturnType<typeof buildIssueReadiness>>['eveningBriefing']
  draftSummary: Awaited<ReturnType<typeof buildIssueReadiness>>['draftSummary']
}

function parsePositiveInt(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.round(parsed)))
}

function isValidIssueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  return !!cronSecret && request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 500) }
  }
}

async function requestSelf(
  request: NextRequest,
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(new URL(path, request.url), {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  return {
    ok: response.ok,
    status: response.status,
    body: await parseJson(response),
  }
}

async function postToSelf(request: NextRequest, path: string, body: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
  return requestSelf(request, path, 'POST', body)
}

async function patchToSelf(request: NextRequest, path: string, body: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
  return requestSelf(request, path, 'PATCH', body)
}

async function getSnapshot(issueDate: string): Promise<Snapshot> {
  const draft = await getIssueByDate(issueDate, false)
  const blocks = draft ? await getIssueBlocks(draft.id) : []
  const { candidates, automation, candidateError } = await getAdminRunSummaries()
  const { readiness, eveningBriefing, draftSummary } = await buildIssueReadiness({
    issueDate,
    draft,
    blocks,
    candidates,
    automation,
  })

  return {
    draft,
    blocks,
    candidates,
    automation,
    candidateError,
    readiness,
    eveningBriefing,
    draftSummary,
  }
}

function candidateStatusRank(candidate: ArticleCandidate): number {
  if (candidate.status === 'approved') return 0
  if (candidate.status === 'shortlisted') return 1
  return 2
}

function selectAutopublishCandidates(
  candidates: ArticleCandidate[],
  neededArticles: number,
  maxCandidateImports: number,
): ArticleCandidate[] {
  if (neededArticles <= 0 || maxCandidateImports <= 0) return []
  const importBudget = Math.min(maxCandidateImports, neededArticles + 4)
  const ranked = [...candidates].sort((a, b) =>
    candidateStatusRank(a) - candidateStatusRank(b)
    || b.score - a.score
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    || a.title.localeCompare(b.title)
  )
  const strong = ranked.filter(candidate => candidate.score >= MIN_AUTOPUBLISH_CANDIDATE_SCORE)
  const selected = strong.slice(0, importBudget)

  if (selected.length >= Math.min(neededArticles, importBudget)) return selected

  const selectedIds = new Set(selected.map(candidate => candidate.id))
  for (const candidate of ranked) {
    if (selected.length >= importBudget) break
    if (selectedIds.has(candidate.id)) continue
    selected.push(candidate)
    selectedIds.add(candidate.id)
  }

  return selected
}

function candidateImportPayload(candidate: ArticleCandidate) {
  return {
    title: candidate.title,
    summary: candidate.summary,
    url: candidate.url,
    category: candidate.category,
  }
}

function importResults(body: unknown): Array<{
  url: string
  ok: boolean
  issueId?: string
  issueDate?: string
  issueNumber?: number
  title?: string
  skippedReason?: string
  error?: string
}> {
  if (!body || typeof body !== 'object' || !('results' in body)) return []
  const results = (body as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results.filter((result): result is {
    url: string
    ok: boolean
    issueId?: string
    issueDate?: string
    issueNumber?: number
    title?: string
    skippedReason?: string
    error?: string
  } => !!result && typeof result === 'object' && typeof (result as { url?: unknown }).url === 'string')
}

async function markImportedCandidates(
  request: NextRequest,
  adminPassword: string,
  selectedCandidates: ArticleCandidate[],
  importBody: unknown,
): Promise<AutopublishOperation[]> {
  const operations: AutopublishOperation[] = []
  const candidatesByUrl = new Map(selectedCandidates.map(candidate => [candidate.url, candidate]))

  for (const result of importResults(importBody)) {
    if (!result.ok || !result.issueId || !result.issueDate) continue
    const candidate = candidatesByUrl.get(result.url)
    if (!candidate) continue

    const mark = await patchToSelf(request, `/api/article-candidates/${candidate.id}`, {
      adminPassword,
      status: 'imported',
      importedIssueId: result.issueId,
      importedIssueDate: result.issueDate,
    })
    operations.push({
      type: 'candidate_mark_imported',
      ok: mark.ok,
      status: mark.status,
      detail: mark.ok
        ? `Marked candidate "${candidate.title}" as imported into ${result.issueDate}.`
        : `Could not mark candidate "${candidate.title}" as imported.`,
      body: mark.body,
    })
  }

  return operations
}

async function runAutopublish(request: NextRequest, opts: AutopublishRequestOptions) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error: missing ADMIN_PASSWORD.' }, { status: 500 })
  }

  const issueDate = opts.dateOverride ?? issueDateFor()
  if (!isValidIssueDate(issueDate)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD.' }, { status: 400 })
  }

  const operations: AutopublishOperation[] = []
  let snapshot = await getSnapshot(issueDate)

  if (snapshot.draft?.published) {
    const decision = evaluateAutopublishDecision({
      draft: snapshot.draftSummary,
      readiness: snapshot.readiness,
      eveningBriefing: snapshot.eveningBriefing,
      minimumArticleCount: opts.minimumArticleCount,
      targetArticleCount: opts.targetArticles,
    })
    return NextResponse.json({
      dryRun: opts.dryRun || undefined,
      skipped: true,
      reason: 'already_published',
      issueDate,
      issueId: snapshot.draft.id,
      issueNumber: snapshot.draft.issueNumber,
      articleCount: snapshot.draftSummary.articleCount,
      decision,
      eveningBriefing: snapshot.eveningBriefing,
      operations,
    })
  }

  const shouldAssemble = !snapshot.draftSummary.exists || snapshot.draftSummary.articleCount < opts.targetArticles
  if (shouldAssemble) {
    const assemble = await postToSelf(request, '/api/cron/daily-assemble', {
      adminPassword,
      dryRun: opts.dryRun,
      date: issueDate,
      maxArticles: opts.targetArticles,
    })
    operations.push({
      type: 'assemble',
      ok: assemble.ok,
      status: assemble.status,
      dryRun: opts.dryRun,
      detail: assemble.ok
        ? `${opts.dryRun ? 'Checked' : 'Ran'} daily assemble for ${issueDate}.`
        : `Daily assemble failed for ${issueDate}.`,
      body: assemble.body,
    })

    if (!assemble.ok) {
      return NextResponse.json({
        dryRun: opts.dryRun || undefined,
        skipped: true,
        reason: 'assemble_failed',
        issueDate,
        operations,
      }, { status: 502 })
    }

    if (!opts.dryRun) {
      snapshot = await getSnapshot(issueDate)
    }
  }

  const canImportCandidatesForDate = issueDate === issueDateFor()
  const neededArticles = Math.max(0, opts.targetArticles - snapshot.draftSummary.articleCount)
  let selectedCandidates: ArticleCandidate[] = []

  if (neededArticles > 0 && isArticleCandidateStoreConfigured() && canImportCandidatesForDate) {
    const candidates = await listArticleCandidates({ statuses: ['approved', 'shortlisted', 'new'], limit: 150 })
    selectedCandidates = selectAutopublishCandidates(candidates, neededArticles, opts.maxCandidateImports)

    if (selectedCandidates.length > 0) {
      if (opts.dryRun) {
        operations.push({
          type: 'candidate_import',
          ok: true,
          dryRun: true,
          detail: `Would import ${selectedCandidates.length} candidate${selectedCandidates.length === 1 ? '' : 's'} to fill the draft.`,
          body: {
            neededArticles,
            selected: selectedCandidates.map(candidate => ({
              id: candidate.id,
              title: candidate.title,
              score: candidate.score,
              status: candidate.status,
              category: candidate.category,
            })),
          },
        })
      } else {
        const candidateImport = await postToSelf(request, '/api/import-briefing-articles', {
          adminPassword,
          rewriteWithAi: Boolean(process.env.OPENAI_API_KEY),
          articles: selectedCandidates.map(candidateImportPayload),
        })
        operations.push({
          type: 'candidate_import',
          ok: candidateImport.ok,
          status: candidateImport.status,
          detail: candidateImport.ok
            ? `Imported candidate articles for ${issueDate}.`
            : `Candidate import failed for ${issueDate}.`,
          body: candidateImport.body,
        })

        if (candidateImport.ok) {
          operations.push(...await markImportedCandidates(request, adminPassword, selectedCandidates, candidateImport.body))
          snapshot = await getSnapshot(issueDate)
        }
      }
    } else {
      operations.push({
        type: 'candidate_import',
        ok: true,
        dryRun: opts.dryRun || undefined,
        detail: 'No suitable active candidates were available to fill the draft.',
        body: { neededArticles },
      })
    }
  } else if (neededArticles > 0 && !canImportCandidatesForDate) {
    operations.push({
      type: 'candidate_import',
      ok: true,
      dryRun: opts.dryRun || undefined,
      detail: `Skipped candidate import because candidate import only targets today's Winnipeg issue date (${issueDateFor()}).`,
      body: { neededArticles, issueDate },
    })
  }

  if (!opts.dryRun) {
    snapshot = await getSnapshot(issueDate)
  }

  const decision = evaluateAutopublishDecision({
    draft: snapshot.draftSummary,
    readiness: snapshot.readiness,
    eveningBriefing: snapshot.eveningBriefing,
    minimumArticleCount: opts.minimumArticleCount,
    targetArticleCount: opts.targetArticles,
  })

  if (opts.dryRun || !decision.publishable || !snapshot.draft) {
    return NextResponse.json({
      dryRun: opts.dryRun || undefined,
      publishable: decision.publishable,
      skipped: !decision.publishable,
      reason: decision.reason,
      issueDate,
      issueId: snapshot.draft?.id ?? null,
      issueNumber: snapshot.draft?.issueNumber ?? null,
      articleCount: snapshot.draftSummary.articleCount,
      decision,
      selectedCandidates: selectedCandidates.map(candidate => ({
        id: candidate.id,
        title: candidate.title,
        score: candidate.score,
        status: candidate.status,
        category: candidate.category,
      })),
      eveningBriefing: snapshot.eveningBriefing,
      candidateError: snapshot.candidateError,
      operations,
    })
  }

  const summary = await buildIssuePublishSummary(snapshot.draft, snapshot.blocks)
  const issue = await publishIssue(snapshot.draft.id, { summary })
  revalidatePath('/', 'layout')
  operations.push({
    type: 'publish',
    ok: true,
    detail: `Published issue #${issue.issueNumber} for ${issue.issueDate} with ${decision.articleCount} articles.`,
    body: {
      issueId: issue.id,
      issueNumber: issue.issueNumber,
      issueDate: issue.issueDate,
    },
  })

  return NextResponse.json({
    published: true,
    reason: decision.reason,
    issueId: issue.id,
    issueNumber: issue.issueNumber,
    issueDate: issue.issueDate,
    articleCount: decision.articleCount,
    decision,
    eveningBriefing: snapshot.eveningBriefing,
    operations,
  })
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true'
  const dateOverride = url.searchParams.get('date') ?? undefined
  const minimumArticleCount = parsePositiveInt(
    url.searchParams.get('minimumArticleCount'),
    MIN_DAILY_ISSUE_ARTICLES,
    MIN_DAILY_ISSUE_ARTICLES,
    20,
  )
  const targetArticles = parsePositiveInt(
    url.searchParams.get('targetArticles'),
    DAILY_PUBLISH_ARTICLE_TARGET,
    minimumArticleCount,
    20,
  )
  const maxCandidateImports = parsePositiveInt(
    url.searchParams.get('maxCandidateImports'),
    DEFAULT_MAX_CANDIDATE_IMPORTS,
    0,
    30,
  )

  return runAutopublish(request, {
    dryRun,
    dateOverride,
    maxCandidateImports,
    minimumArticleCount,
    targetArticles,
  })
}

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json({ error: 'Server configuration error: missing ADMIN_PASSWORD.' }, { status: 500 })
  }

  let body: {
    adminPassword?: string
    dryRun?: boolean
    date?: string
    maxCandidateImports?: number
    targetArticles?: number
    minimumArticleCount?: number
    confirmation?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.adminPassword || body.adminPassword !== adminPassword) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const dryRun = body.dryRun !== false
  if (!dryRun && body.confirmation !== MANUAL_AUTOPUBLISH_CONFIRMATION) {
    return NextResponse.json({
      error: 'Manual autopublish requires deliberate confirmation.',
      requiredConfirmation: MANUAL_AUTOPUBLISH_CONFIRMATION,
    }, { status: 409 })
  }

  const minimumArticleCount = Math.max(
    MIN_DAILY_ISSUE_ARTICLES,
    Math.min(20, Math.round(body.minimumArticleCount ?? MIN_DAILY_ISSUE_ARTICLES)),
  )
  const targetArticles = Math.max(
    minimumArticleCount,
    Math.min(20, Math.round(body.targetArticles ?? DAILY_PUBLISH_ARTICLE_TARGET)),
  )

  return runAutopublish(request, {
    dryRun,
    dateOverride: body.date,
    maxCandidateImports: Math.max(0, Math.min(30, Math.round(body.maxCandidateImports ?? DEFAULT_MAX_CANDIDATE_IMPORTS))),
    minimumArticleCount,
    targetArticles,
  })
}
