import { NextRequest, NextResponse } from 'next/server'
import { parseDailyArticles } from '@/lib/draft-articles'
import { buildAdminReadiness } from '@/lib/admin-readiness'
import { issueDateFor } from '@/lib/issue-date'
import { isArticleCandidateStoreConfigured, summarizeArticleCandidates } from '@/lib/article-candidate-store'
import { buildKnownTitleList } from '@/lib/known-urls'
import { findIssueMemoryWarnings } from '@/lib/issue-memory'
import { getIssueByDate, getIssueBlocks } from '@/lib/issue-store'
import { titleQualityWarnings } from '@/lib/title-quality'

export const dynamic = 'force-dynamic'

function authorize(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return { ok: false as const, status: 500, error: 'Server configuration error.' }
  const password = request.headers.get('x-admin-password')
  if (!password || password !== adminPassword) return { ok: false as const, status: 401, error: 'Incorrect password.' }
  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const today = request.nextUrl.searchParams.get('date') ?? issueDateFor()
  const draft = await getIssueByDate(today, false)
  const blocks = draft ? await getIssueBlocks(draft.id) : []
  const articles = parseDailyArticles(blocks)
  const knownTitles = draft
    ? (await buildKnownTitleList(90)).filter(entry => entry.pageId !== draft.id)
    : await buildKnownTitleList(90)

  const missingTitleCount = articles.filter(article => !article.title?.trim()).length
  const missingSummaryCount = articles.filter(article => !article.annotation?.trim()).length
  const missingImageCount = articles.filter(article => !article.imageUrl?.trim()).length
  const weakTitleCount = articles.flatMap(article => titleQualityWarnings(article.title)).length
  const similarTopicCount = articles.filter(article =>
    article.title && findIssueMemoryWarnings(article.title, knownTitles).length > 0,
  ).length
  const sections = [...new Set(articles.map(article => article.category).filter((value): value is string => Boolean(value)))]

  const candidates = isArticleCandidateStoreConfigured()
    ? await summarizeArticleCandidates()
    : { totalActive: 0, topPicks: 0, held: 0, rejected: 0, imported: 0 }

  const automation = {
    lastRunAt: null,
    sourceCount: 0,
    failureCount: isArticleCandidateStoreConfigured() ? 0 : 1,
  }

  const draftSummary = {
    exists: !!draft,
    published: !!draft?.published,
    issueId: draft?.id ?? null,
    issueNumber: draft?.issueNumber ?? null,
    issueDate: draft?.issueDate ?? today,
    articleCount: articles.length,
    sections,
    missingSummaryCount,
    missingTitleCount,
    exactDuplicateUrlCount: 0,
    similarTopicCount,
    staleSourceCount: 0,
    weakTitleCount,
    missingImageCount,
    brokenRequiredUrlCount: 0,
    publishReadinessFailed: false,
  }

  const readiness = buildAdminReadiness({
    issueDate: today,
    automation,
    candidates,
    draft: draftSummary,
  })

  return NextResponse.json({
    issueDate: today,
    automation,
    candidates,
    draft: draftSummary,
    readiness,
  })
}
