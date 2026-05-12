import { CATEGORY_ORDER, isCanadaMention, type Category } from './category-mapping'
import { normalizeUrl } from './url-normalize'

export type CandidateStatus = 'new' | 'shortlisted' | 'approved' | 'rejected' | 'imported'

export type CandidateSourceType =
  | 'google_alerts'
  | 'canada_briefing'
  | 'ai_voices'
  | 'research'
  | 'agriculture'
  | 'manual'
  | 'other'

export interface IncomingArticleCandidate {
  title: string
  url: string
  summary?: string | null
  source?: string | null
  sourceType?: CandidateSourceType | null
  publishedAt?: string | null
  category?: string | null
  score?: number | null
  scoreReasons?: string[] | null
  status?: CandidateStatus | null
}

export interface NormalizedArticleCandidate {
  title: string
  url: string
  canonicalUrl: string
  summary: string
  source: string
  sourceType: CandidateSourceType
  publishedAt: string | null
  category: Category
  status: CandidateStatus
  score: number
  scoreReasons: string[]
}

export interface ArticleCandidate extends NormalizedArticleCandidate {
  id: string
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  importedAt: string | null
  rejectionReason: string | null
}

const VALID_STATUSES = new Set<CandidateStatus>(['new', 'shortlisted', 'approved', 'rejected', 'imported'])
const VALID_SOURCE_TYPES = new Set<CandidateSourceType>([
  'google_alerts',
  'canada_briefing',
  'ai_voices',
  'research',
  'agriculture',
  'manual',
  'other',
])

const STRONG_SOURCES = [
  'reuters',
  'associated press',
  'ap news',
  'canada.ca',
  'gc.ca',
  'tbs-sct.gc.ca',
  'ised-isde.canada.ca',
  'openai',
  'anthropic',
  'google deepmind',
  'meta ai',
  'metr',
  'epoch ai',
  'hugging face',
  'arxiv',
]

const WEAK_SOURCE_PATTERNS = [
  'sponsored',
  'press release distribution',
  'ein news',
  'globenewswire',
  'pr newswire',
  'seo',
  'crypto',
]

const POLICY_SIGNALS = [
  'policy',
  'regulation',
  'regulator',
  'privacy',
  'governance',
  'ethic',
  'copyright',
  'intellectual property',
  'online safety',
]

const GOVERNMENT_SIGNALS = [
  'government',
  'public sector',
  'federal',
  'municipal',
  'provincial',
  'sovereign',
  'minister',
]

const RESEARCH_SIGNALS = [
  'research',
  'paper',
  'benchmark',
  'arxiv',
  'study',
  'measuring',
]

const SECTOR_SIGNALS = [
  'agriculture',
  'grain',
  'crop',
  'wheat',
  'health',
  'medical',
  'education',
  'legal',
  'mining',
]

function coerceStatus(value: CandidateStatus | null | undefined): CandidateStatus {
  return value && VALID_STATUSES.has(value) ? value : 'new'
}

function coerceSourceType(value: CandidateSourceType | null | undefined): CandidateSourceType {
  return value && VALID_SOURCE_TYPES.has(value) ? value : 'other'
}

export function coerceCategory(value: string | null | undefined): Category {
  if (value && CATEGORY_ORDER.includes(value as Category)) return value as Category
  return 'Industry & Models'
}

function candidateText(
  input: Pick<IncomingArticleCandidate, 'title' | 'summary' | 'source' | 'sourceType' | 'category'>,
): string {
  return `${input.title ?? ''} ${input.summary ?? ''} ${input.source ?? ''} ${input.sourceType ?? ''} ${input.category ?? ''}`.toLowerCase()
}

function hasAnySignal(text: string, signals: string[]): boolean {
  return signals.some(signal => text.includes(signal))
}

export function isCanadaRelevant(
  input: Pick<IncomingArticleCandidate, 'title' | 'summary' | 'source' | 'sourceType' | 'category'>,
): boolean {
  return isCanadaMention(input)
}

export function inferCandidateCategory(
  input: Pick<IncomingArticleCandidate, 'title' | 'summary' | 'source' | 'sourceType' | 'category'>,
): Category {
  const text = candidateText(input)
  if (isCanadaRelevant(input)) return 'Canada'
  if (hasAnySignal(text, SECTOR_SIGNALS)) return 'Sectors & Applications'
  if (hasAnySignal(text, POLICY_SIGNALS)) return 'Policy & Regulation'
  if (hasAnySignal(text, GOVERNMENT_SIGNALS)) return 'Government & Public Sector'
  if (hasAnySignal(text, RESEARCH_SIGNALS) || coerceSourceType(input.sourceType) === 'research') return 'Research'
  return 'Industry & Models'
}

function daysOld(publishedAt: string | null, now: Date): number | null {
  if (!publishedAt) return null
  const parsed = new Date(publishedAt)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.max(0, (now.getTime() - parsed.getTime()) / 86_400_000)
}

export function scoreArticleCandidate(
  input: Pick<IncomingArticleCandidate, 'title' | 'summary' | 'source' | 'sourceType' | 'publishedAt' | 'category'>,
  now = new Date(),
): { score: number; reasons: string[] } {
  const text = candidateText(input)
  const sourceType = coerceSourceType(input.sourceType)
  const age = daysOld(input.publishedAt ?? null, now)
  let score = 40
  const reasons: string[] = ['Baseline candidate']

  if (age !== null && age <= 2) {
    score += 12
    reasons.push('Fresh within 48 hours')
  } else if (age !== null && age > 7) {
    score -= 12
    reasons.push('Older than 7 days')
  }

  if (isCanadaRelevant(input)) {
    score += 24
    reasons.push('Canadian relevance')
  }

  if (sourceType === 'ai_voices' || sourceType === 'research') {
    score += 8
    reasons.push('High-signal expert or research source')
  }

  if (sourceType === 'agriculture') {
    score += 4
    reasons.push('Sector-specific AI signal')
  }

  if (STRONG_SOURCES.some(source => text.includes(source))) {
    score += 10
    reasons.push('Primary or high-credibility source')
  }

  if (text.includes('policy') || text.includes('regulation') || text.includes('public sector') || text.includes('governance')) {
    score += 6
    reasons.push('Policy, governance, or public-sector relevance')
  }

  if (text.includes('model') || text.includes('agent') || text.includes('benchmark') || text.includes('evaluation')) {
    score += 5
    reasons.push('Model, agent, benchmark, or evaluation relevance')
  }

  if (WEAK_SOURCE_PATTERNS.some(pattern => text.includes(pattern))) {
    score -= 12
    reasons.push('Weak or promotional source signal')
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  }
}

function normalizeProvidedScore(score: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  return clamped <= 20 ? clamped * 5 : clamped
}

function scoreFromInput(input: IncomingArticleCandidate): { score: number; reasons: string[] } {
  const computed = scoreArticleCandidate(input)
  if (input.score === null || input.score === undefined) return computed

  const provided = normalizeProvidedScore(input.score)
  if (provided >= computed.score) {
    return {
      score: provided,
      reasons: input.scoreReasons ?? ['Provided by source automation'],
    }
  }

  return {
    score: computed.score,
    reasons: [
      ...computed.reasons,
      ...(input.scoreReasons ?? []).map(reason => `Source note: ${reason}`),
    ],
  }
}

export function normalizeArticleCandidate(input: IncomingArticleCandidate): NormalizedArticleCandidate {
  const title = input.title?.trim()
  const rawUrl = input.url?.trim()
  if (!title) throw new Error('Candidate title is required.')
  if (!rawUrl) throw new Error('Candidate URL is required.')
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Candidate URL must use http or https.')
    }
  } catch {
    throw new Error(`Candidate URL is invalid: ${rawUrl}`)
  }
  const canonicalUrl = normalizeUrl(rawUrl)

  const sourceType = coerceSourceType(input.sourceType)
  const inferredCategory = inferCandidateCategory(input)
  const category = inferredCategory === 'Canada'
    ? inferredCategory
    : input.category && CATEGORY_ORDER.includes(input.category as Category)
      ? input.category as Category
      : inferredCategory
  const scored = scoreFromInput(input)

  return {
    title,
    url: rawUrl,
    canonicalUrl,
    summary: input.summary?.trim() || '',
    source: input.source?.trim() || 'Unknown source',
    sourceType,
    publishedAt: input.publishedAt?.trim() || null,
    category,
    status: coerceStatus(input.status),
    score: scored.score,
    scoreReasons: scored.reasons.filter(Boolean),
  }
}

export function normalizeArticleCandidates(inputs: IncomingArticleCandidate[]): NormalizedArticleCandidate[] {
  const seen = new Set<string>()
  const normalized: NormalizedArticleCandidate[] = []
  for (const input of inputs) {
    const candidate = normalizeArticleCandidate(input)
    if (seen.has(candidate.canonicalUrl)) continue
    seen.add(candidate.canonicalUrl)
    normalized.push(candidate)
  }
  return normalized
}

function categoryRank(candidate: Pick<ArticleCandidate, 'category'>): number {
  const index = CATEGORY_ORDER.indexOf(candidate.category as Category)
  return index === -1 ? CATEGORY_ORDER.length : index
}

function canadaPriority(candidate: Pick<ArticleCandidate, 'title' | 'summary' | 'source' | 'sourceType' | 'category'>): number {
  if (candidate.category === 'Canada') return 0
  if (isCanadaRelevant(candidate)) return 1
  return 2
}

export function compareArticleCandidates(a: ArticleCandidate, b: ArticleCandidate): number {
  return canadaPriority(a) - canadaPriority(b)
    || categoryRank(a) - categoryRank(b)
    || b.score - a.score
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    || a.title.localeCompare(b.title)
}
