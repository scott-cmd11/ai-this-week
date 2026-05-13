import type {
  AdminAutomationSummary,
  AdminCandidateSummary,
  AdminEveningBriefingSummary,
  AdminSourceBreakdownItem,
} from './admin-readiness'
import { buildAdminReadiness, buildEveningBriefingSummary } from './admin-readiness'
import { isPublishedDateFreshForIssue } from './article-fetcher'
import { isArticleCandidateStoreConfigured, listArticleCandidates, summarizeArticleCandidates } from './article-candidate-store'
import { parseDailyArticles } from './draft-articles'
import { findIssueMemoryWarnings } from './issue-memory'
import { buildKnownTitleList, buildKnownUrlMap } from './known-urls'
import { titleQualityWarnings } from './title-quality'
import type { Issue, NotionBlock } from './types'
import { normalizeUrl } from './url-normalize'

const EMPTY_CANDIDATES: AdminCandidateSummary = {
  totalActive: 0,
  topPicks: 0,
  held: 0,
  rejected: 0,
  imported: 0,
  importedWithoutIssueContext: 0,
  totalVisible: 0,
  latestCandidateAt: null,
  latestActiveCandidateAt: null,
  sourceBreakdown: [],
}

const EMPTY_AUTOMATION: AdminAutomationSummary = {
  lastRunAt: null,
  sourceCount: 0,
  failureCount: 0,
}

export async function getAdminRunSummaries(): Promise<{
  candidates: AdminCandidateSummary
  automation: AdminAutomationSummary
  candidateError: string | null
}> {
  const candidateStoreConfigured = isArticleCandidateStoreConfigured()
  let candidates = EMPTY_CANDIDATES
  let candidateError: string | null = candidateStoreConfigured ? null : 'Article candidate inbox is not configured.'
  if (candidateStoreConfigured) {
    try {
      candidates = await summarizeArticleCandidates()
      const activeCandidates = await listArticleCandidates({ statuses: ['new', 'approved', 'shortlisted'], limit: 150 })
      const importedCandidates = await listArticleCandidates({ statuses: ['imported'], limit: 150 })
      const rejectedCandidates = await listArticleCandidates({ statuses: ['rejected'], limit: 150 })
      const visibleCandidates = [...activeCandidates, ...importedCandidates, ...rejectedCandidates]
      const sourceBreakdown = buildSourceBreakdown(visibleCandidates)
      if (importedCandidates.length > 0) {
        const knownUrls = await buildKnownUrlMap(90)
        candidates = {
          ...candidates,
          importedWithoutIssueContext: importedCandidates.filter(candidate => !knownUrls.has(candidate.canonicalUrl)).length,
        }
      }
      candidates = {
        ...candidates,
        totalVisible: candidates.totalActive + candidates.held + candidates.rejected + candidates.imported,
        latestCandidateAt: newestCandidateTimestamp(visibleCandidates),
        latestActiveCandidateAt: newestCandidateTimestamp(activeCandidates),
        sourceBreakdown,
      }
    } catch (err) {
      candidateError = err instanceof Error ? err.message : 'Candidate summary failed.'
    }
  }

  return {
    candidates,
    candidateError,
    automation: {
      lastRunAt: candidates.latestCandidateAt ?? null,
      sourceCount: candidates.sourceBreakdown?.length ?? 0,
      failureCount: candidateError ? 1 : 0,
    },
  }
}

function newestCandidateTimestamp(candidates: Array<{ createdAt: string; updatedAt?: string | null }>): string | null {
  let newest: string | null = null
  for (const candidate of candidates) {
    const timestamp = candidate.createdAt || candidate.updatedAt
    if (!timestamp) continue
    if (!newest || new Date(timestamp).getTime() > new Date(newest).getTime()) {
      newest = timestamp
    }
  }
  return newest
}

function buildSourceBreakdown(
  candidates: Array<{ source: string; createdAt: string; updatedAt?: string | null }>,
): AdminSourceBreakdownItem[] {
  const sources = new Map<string, AdminSourceBreakdownItem>()
  for (const candidate of candidates) {
    const name = candidate.source?.trim() || 'Unknown source'
    const current = sources.get(name) ?? { name, count: 0, newestAt: null }
    const timestamp = candidate.createdAt || candidate.updatedAt || null
    current.count += 1
    if (timestamp && (!current.newestAt || new Date(timestamp).getTime() > new Date(current.newestAt).getTime())) {
      current.newestAt = timestamp
    }
    sources.set(name, current)
  }
  return [...sources.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8)
}

function blockText(block: NotionBlock): string {
  return block.content || block.richText?.map(segment => segment.text).join('') || ''
}

function validHttpUrl(url: string | null): boolean {
  if (!url?.trim()) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function publishedDatesByArticle(blocks: NotionBlock[]): Array<string | null> {
  const dates: Array<string | null> = []
  let articleIndex = -1

  for (const block of blocks) {
    if (block.type === 'heading_3') {
      articleIndex += 1
      dates[articleIndex] = null
      continue
    }
    if (articleIndex < 0 || block.type !== 'paragraph') continue
    const text = blockText(block).trim()
    if (!text.toLowerCase().startsWith('published:')) continue
    dates[articleIndex] = text.replace(/^published:\s*/i, '').trim() || null
  }

  return dates
}

export async function buildIssueReadiness({
  issueDate,
  draft,
  blocks,
  candidates = EMPTY_CANDIDATES,
  automation = EMPTY_AUTOMATION,
}: {
  issueDate: string
  draft: Issue | null
  blocks: NotionBlock[]
  candidates?: AdminCandidateSummary
  automation?: AdminAutomationSummary
}) {
  const articles = parseDailyArticles(blocks)
  const knownTitles = draft
    ? (await buildKnownTitleList(90)).filter(entry => entry.pageId !== draft.id)
    : await buildKnownTitleList(90)
  const knownUrls = draft
    ? new Map([...await buildKnownUrlMap(90)].filter(([, entry]) => entry.pageId !== draft.id))
    : await buildKnownUrlMap(90)
  const publishedDates = publishedDatesByArticle(blocks)

  const seenUrls = new Set<string>()
  let exactDuplicateUrlCount = 0
  for (const article of articles) {
    if (!validHttpUrl(article.url)) continue
    const normalized = normalizeUrl(article.url ?? '')
    if (!normalized) continue
    if (seenUrls.has(normalized) || knownUrls.has(normalized)) exactDuplicateUrlCount += 1
    seenUrls.add(normalized)
  }

  const missingTitleCount = articles.filter(article => !article.title?.trim()).length
  const missingSummaryCount = articles.filter(article => !article.annotation?.trim()).length
  const missingImageCount = articles.filter(article => !article.imageUrl?.trim()).length
  const weakTitleCount = articles.flatMap(article => titleQualityWarnings(article.title)).length
  const similarTopicCount = articles.filter(article =>
    article.title && findIssueMemoryWarnings(article.title, knownTitles).length > 0,
  ).length
  const staleSourceCount = articles.filter((_, index) =>
    publishedDates[index] && !isPublishedDateFreshForIssue(publishedDates[index], draft?.issueDate ?? issueDate),
  ).length
  const brokenRequiredUrlCount = articles.filter(article => !validHttpUrl(article.url)).length
  const sections = [...new Set(articles.map(article => article.category).filter((value): value is string => Boolean(value)))]

  const draftSummary = {
    exists: !!draft,
    published: !!draft?.published,
    issueId: draft?.id ?? null,
    issueNumber: draft?.issueNumber ?? null,
    issueDate: draft?.issueDate ?? issueDate,
    articleCount: articles.length,
    sections,
    missingSummaryCount,
    missingTitleCount,
    exactDuplicateUrlCount,
    similarTopicCount,
    staleSourceCount,
    weakTitleCount,
    missingImageCount,
    brokenRequiredUrlCount,
    publishReadinessFailed: false,
  }

  const readinessInput = {
    issueDate,
    automation,
    candidates,
    draft: draftSummary,
  }
  const readiness = buildAdminReadiness(readinessInput)
  const eveningBriefing: AdminEveningBriefingSummary = buildEveningBriefingSummary(readinessInput)

  return {
    articles,
    draftSummary,
    readiness,
    eveningBriefing,
  }
}
