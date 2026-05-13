import {
  GOOD_NEWS_CATEGORIES,
  type GoodNewsCandidateInput,
  type GoodNewsCategory,
  type GoodNewsStory,
} from './good-news-types'
import { normalizeUrl } from './url-normalize'

const CATEGORY_SIGNALS: Record<GoodNewsCategory, string[]> = {
  Health: ['health', 'healthcare', 'medical', 'patient', 'clinical', 'cancer', 'screening', 'hospital', 'diagnosis'],
  Education: ['education', 'school', 'student', 'teacher', 'classroom', 'learning', 'tutor', 'khan', 'educator'],
  Accessibility: ['accessibility', 'assistive', 'blind', 'low vision', 'disability', 'disabled', 'caption', 'screen reader'],
  Science: ['science', 'research', 'researcher', 'biology', 'molecular', 'materials', 'laboratory', 'paper', 'study'],
  Climate: ['climate', 'weather', 'energy', 'grid', 'emissions', 'renewable', 'wildfire', 'forecast', 'resilience'],
  Work: ['productivity', 'workflow', 'worker', 'team', 'operations', 'developer', 'coding', 'assistant'],
  Creativity: ['creative', 'creator', 'artist', 'design', 'music', 'video', 'media', 'writing'],
  Safety: ['safety', 'warning', 'emergency', 'forecasting', 'detection', 'risk reduction', 'resilience'],
  'Public Good': ['public good', 'public service', 'government', 'civic', 'public-sector', 'public sector', 'agency'],
  'Small Business': ['small business', 'smb', 'entrepreneur', 'local business', 'commerce', 'shop', 'owners'],
}

const BENEFIT_SIGNALS = [
  'help',
  'helps',
  'improve',
  'improves',
  'support',
  'supports',
  'access',
  'faster',
  'efficient',
  'resilience',
  'early results',
  'measured',
  'trial',
  'study',
  'pilot',
  'public',
  'free access',
  'researchers report',
  'clinical',
]

const EVIDENCE_SIGNALS = [
  'study',
  'trial',
  'randomized',
  'published',
  'research',
  'paper',
  'government',
  'university',
  'foundation',
  'measured',
  'report',
  'named',
  'pilot',
]

const STRONG_SOURCE_SIGNALS = [
  'nature.com',
  'science.org',
  'pubmed',
  'nih.gov',
  'nsf.gov',
  'energy.gov',
  'noaa.gov',
  'gsl.noaa.gov',
  'who.int',
  'deepmind.google',
  'microsoft.com/en-us/research',
  'blogs.microsoft.com/accessibility',
]

const PROMOTIONAL_SIGNALS = [
  'press release',
  'funding',
  'raises',
  'stock',
  'shares',
  'market cap',
  'valuation',
  'launches',
  'announces',
  'unveils',
]

const EXCLUDED_SIGNALS = [
  'job loss',
  'layoff',
  'replace workers',
  'replacing workers',
  'existential risk',
  'scam',
  'fraud',
  'lawsuit',
  'sued',
  'bias',
  'misinformation',
  'disinformation',
  'surveillance',
  'weapon',
  'war',
  'crackdown',
  'opinion',
  'unsupported',
]

export interface GoodNewsScoreResult {
  accepted: boolean
  category: GoodNewsCategory
  positivity_score: number
  credibility_score: number
  tags: string[]
  evidence_notes: string
  rejection_reasons: string[]
}

export function scoreGoodNewsCandidate(input: GoodNewsCandidateInput): GoodNewsScoreResult {
  const text = searchableText(input)
  const category = coerceGoodNewsCategory(input.category) ?? inferGoodNewsCategory(input)
  const categorySignals = CATEGORY_SIGNALS[category].filter(signal => text.includes(signal))
  const benefitSignals = BENEFIT_SIGNALS.filter(signal => text.includes(signal))
  const evidenceSignals = EVIDENCE_SIGNALS.filter(signal => text.includes(signal))
  const strongSource = STRONG_SOURCE_SIGNALS.some(signal => text.includes(signal))
  const promotionalSignals = PROMOTIONAL_SIGNALS.filter(signal => text.includes(signal))
  const excludedSignals = EXCLUDED_SIGNALS.filter(signal => text.includes(signal))

  let positivity = 34
  positivity += Math.min(30, benefitSignals.length * 7)
  positivity += Math.min(14, categorySignals.length * 4)
  positivity += input.summary?.trim() ? 8 : 0
  positivity -= promotionalSignals.length > 0 ? 12 : 0
  positivity -= excludedSignals.length > 0 ? 40 : 0

  let credibility = 42
  credibility += strongSource ? 22 : 0
  credibility += Math.min(20, evidenceSignals.length * 5)
  credibility += hasValidUrl(input.source_url) ? 10 : 0
  credibility += input.published_at ? 6 : 0
  credibility -= promotionalSignals.length > 0 ? 10 : 0
  credibility -= input.source_name?.toLowerCase().includes('example') ? 30 : 0

  const positivity_score = clampScore(positivity)
  const credibility_score = clampScore(credibility)
  const rejection_reasons = [
    ...(excludedSignals.length > 0 ? [`Excluded framing: ${dedupeStrings(excludedSignals).join(', ')}`] : []),
    ...(benefitSignals.length === 0 ? ['No clear beneficial AI use signal.'] : []),
    ...(credibility_score < 45 ? ['Credibility score below MVP threshold.'] : []),
    ...(promotionalSignals.length > 1 ? ['Likely promotional or market-news framing.'] : []),
  ]

  return {
    accepted: rejection_reasons.length === 0 && positivity_score >= 55 && credibility_score >= 45,
    category,
    positivity_score,
    credibility_score,
    tags: suggestTags(input, category),
    evidence_notes: buildEvidenceNotes({
      sourceName: input.source_name,
      strongSource,
      benefitSignals,
      evidenceSignals,
      promotionalSignals,
    }),
    rejection_reasons,
  }
}

export function storyQualityScore(story: Pick<GoodNewsStory, 'positivity_score' | 'credibility_score' | 'published_at' | 'category'>, now = new Date()): number {
  const freshness = freshnessScore(story.published_at, now)
  return Math.round(story.credibility_score * 0.42 + story.positivity_score * 0.38 + freshness * 0.15 + categoryDiversitySeed(story.category) * 0.05)
}

export function coerceGoodNewsCategory(value: string | null | undefined): GoodNewsCategory | null {
  return value && (GOOD_NEWS_CATEGORIES as readonly string[]).includes(value) ? value as GoodNewsCategory : null
}

export function inferGoodNewsCategory(input: GoodNewsCandidateInput): GoodNewsCategory {
  const text = searchableText(input)
  let best: { category: GoodNewsCategory; matches: number } = { category: 'Public Good', matches: 0 }

  for (const category of GOOD_NEWS_CATEGORIES) {
    const matches = CATEGORY_SIGNALS[category].filter(signal => text.includes(signal)).length
    if (matches > best.matches) best = { category, matches }
  }

  return best.category
}

export function normalizeGoodNewsUrl(url: string): string {
  return normalizeUrl(url)
}

function suggestTags(input: GoodNewsCandidateInput, category: GoodNewsCategory): string[] {
  const text = searchableText(input)
  const tags = new Set<string>([category])
  for (const [candidateCategory, signals] of Object.entries(CATEGORY_SIGNALS) as Array<[GoodNewsCategory, string[]]>) {
    for (const signal of signals) {
      if (text.includes(signal)) tags.add(signal.length > 18 ? candidateCategory : signal)
    }
  }
  for (const tag of input.tags ?? []) {
    if (tag.trim()) tags.add(tag.trim())
  }
  return Array.from(tags).slice(0, 6)
}

function searchableText(input: GoodNewsCandidateInput): string {
  return [
    input.title,
    input.source_name,
    input.source_url,
    input.canonical_url,
    input.summary,
    input.content_text,
    input.category,
    ...(input.tags ?? []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function buildEvidenceNotes({
  sourceName,
  strongSource,
  benefitSignals,
  evidenceSignals,
  promotionalSignals,
}: {
  sourceName?: string | null
  strongSource: boolean
  benefitSignals: string[]
  evidenceSignals: string[]
  promotionalSignals: string[]
}): string {
  const parts = [
    sourceName ? `Source: ${sourceName}.` : 'Source name needs review.',
    strongSource ? 'Primary or high-credibility source signal found.' : 'Source credibility should be checked by an editor.',
    benefitSignals.length > 0 ? `Benefit signals: ${dedupeStrings(benefitSignals).slice(0, 4).join(', ')}.` : 'No strong benefit signal found.',
    evidenceSignals.length > 0 ? `Evidence signals: ${dedupeStrings(evidenceSignals).slice(0, 4).join(', ')}.` : 'Evidence should be strengthened before publication.',
    promotionalSignals.length > 0 ? `Promotional signals to review: ${dedupeStrings(promotionalSignals).join(', ')}.` : '',
  ]
  return parts.filter(Boolean).join(' ')
}

function freshnessScore(publishedAt: string, now: Date): number {
  const published = new Date(publishedAt)
  if (Number.isNaN(published.getTime())) return 35
  const ageHours = Math.max(0, (now.getTime() - published.getTime()) / 3_600_000)
  if (ageHours <= 24) return 100
  if (ageHours <= 72) return 82
  if (ageHours <= 168) return 65
  return 38
}

function categoryDiversitySeed(category: GoodNewsCategory): number {
  return GOOD_NEWS_CATEGORIES.indexOf(category) + 1
}

function hasValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}
