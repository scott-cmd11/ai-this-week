import {
  GOOD_NEWS_CATEGORIES,
  type GoodNewsCandidateInput,
  type GoodNewsCategory,
  type GoodNewsStory,
} from './good-news-types'
import { normalizeUrl } from './url-normalize'

const CATEGORY_SIGNALS: Record<GoodNewsCategory, string[]> = {
  Health: ['health', 'healthcare', 'health care', 'medical', 'medicine', 'patient', 'clinical', 'cancer', 'screening', 'hospital', 'diagnosis', 'care delivery'],
  Education: ['education', 'school', 'student', 'teacher', 'classroom', 'learning', 'tutor', 'tutoring', 'khan', 'educator'],
  Accessibility: ['accessibility', 'assistive', 'inclusive', 'blind', 'low vision', 'disability', 'disabled', 'caption', 'screen reader', 'speech recognition'],
  Science: ['science', 'research', 'researcher', 'biology', 'molecular', 'materials', 'laboratory', 'paper', 'study', 'discovery'],
  Climate: ['climate', 'weather', 'energy', 'grid', 'emissions', 'renewable', 'wildfire', 'forecast', 'resilience'],
  Work: ['productivity', 'workflow', 'worker', 'team', 'operations', 'developer', 'coding', 'assistant', 'supply chain'],
  Creativity: ['creative', 'creator', 'artist', 'design', 'music', 'video', 'media', 'writing'],
  Safety: ['safety', 'warning', 'emergency', 'forecasting', 'detection', 'risk reduction', 'resilience', 'standards', 'measurement'],
  'Public Good': ['public good', 'public service', 'government', 'civic', 'public-sector', 'public sector', 'agency', 'nonprofit', 'community'],
  'Small Business': ['small business', 'smb', 'entrepreneur', 'local business', 'commerce', 'shop', 'owners', 'main street', 'startup'],
}

const AI_RELEVANCE_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'AI', pattern: /\bai\b/ },
  { label: 'artificial intelligence', pattern: /\bartificial intelligence\b/ },
  { label: 'generative AI', pattern: /\bgenerative ai\b/ },
  { label: 'machine learning', pattern: /\bmachine learning\b/ },
  { label: 'deep learning', pattern: /\bdeep learning\b/ },
  { label: 'large language model', pattern: /\blarge language model\b/ },
  { label: 'LLM', pattern: /\bllms?\b/ },
  { label: 'neural network', pattern: /\bneural networks?\b/ },
  { label: 'computer vision', pattern: /\bcomputer vision\b/ },
  { label: 'foundation model', pattern: /\bfoundation models?\b/ },
  { label: 'predictive model', pattern: /\bpredictive models?\b/ },
  { label: 'AI-assisted', pattern: /\bai[- ]assisted\b/ },
  { label: 'AI-powered', pattern: /\bai[- ]powered\b/ },
]

const BENEFIT_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'helps people', pattern: /\bhelps?\b.{0,80}\b(people|patients?|students?|teachers?|learners?|clinicians?|researchers?|scientists?|workers?|communities|small businesses?)\b/ },
  { label: 'helps mission team', pattern: /\bhelps?\b.{0,80}\b(clinical|health|care|public-service|research|education|accessibility|weather|safety)\b.{0,40}\b(teams?|staff|workers?|groups?)\b/ },
  { label: 'supports beneficial workflow', pattern: /\b(supports?|supporting|supported)\b.{0,80}\b(screening|diagnosis|care|learning|teachers?|students?|patients?|researchers?|public service|accessibility)\b/ },
  { label: 'improves outcomes', pattern: /\b(improves?|improving|improved|increase[sd]?|reduces?|reducing|reduced)\b.{0,80}\b(access|accuracy|screening|diagnosis|forecasting|safety|resilience|productivity|learning|care|outcomes?)\b/ },
  { label: 'detects earlier', pattern: /\b(detects?|detection|catch|catches|identify|identifies|screen|screens|triage)\b.{0,80}\b(earlier|patients?|cancer|defects?|cracks?|risks?|disease|infrastructure)\b/ },
  { label: 'accessibility support', pattern: /\b(accessibility|assistive|blind|low vision|disabled|disability|captions?|screen reader|speech recognition)\b/ },
  { label: 'education access', pattern: /\b(students?|teachers?|learners?|classroom|tutor|tutoring|education|course)\b.{0,80}\b(access|accessible|support|practice|feedback|personalization|personalized|fluency)\b/ },
  { label: 'scientific discovery', pattern: /\b(researchers?|scientists?|laborator(?:y|ies)|materials?|biology|molecular|drug discovery|open science)\b.{0,100}\b(accelerate|accelerates|simulation|synthesis|screening|prediction|discovery|tool|free access|measured)\b/ },
  { label: 'public benefit', pattern: /\b(public service|public good|government|agency|community|nonprofit|weather|forecast|grid|emergency|infrastructure|roads?|bridges?)\b.{0,100}\b(support|improve|detect|forecast|resilience|safer|safety|decision support)\b/ },
  { label: 'small business benefit', pattern: /\b(small business|local business|smb|entrepreneur|main street)\b.{0,100}\b(productivity|save time|support|access|resilience|practical)\b/ },
  { label: 'human-benefit deployment', pattern: /\b(deployed|implemented|pilot|trial|launched|free access)\b.{0,100}\b(patients?|students?|teachers?|researchers?|public|community|accessibility|small businesses?)\b/ },
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
  'laboratory',
  'national laboratories',
  'university',
  'research team',
  'study shows',
  'standards',
  'measurement',
  'clinical trial',
  'peer-reviewed',
  'case study',
  'deployment',
  'deployed',
  'implemented',
]

const STRONG_SOURCE_SIGNALS = [
  'nature.com',
  'science.org',
  'news.mit.edu',
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
  'statnews.com',
  'nist.gov',
  'vectorinstitute.ai',
  'scaleai.ca',
  'digitalmainstreet.ca',
  'blog.khanacademy.org',
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

const EXCLUDED_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'job loss or displacement', pattern: /\b(job loss|layoffs?|displacement|replace workers|replacing workers|replaced workers|automation threat)\b/ },
  { label: 'fear or existential-risk framing', pattern: /\b(existential risk|doomsday|catastrophic risk|ai danger|ai threat|fear(?:s)? about ai)\b/ },
  { label: 'scam or fraud framing', pattern: /\b(scams?|fraud|phishing|deepfake scam|cybercrime)\b/ },
  { label: 'legal dispute framing', pattern: /\b(lawsuits?|sued|court fight|legal battle|tech titan trial|blockbuster trial)\b/ },
  { label: 'bias or discrimination framing', pattern: /\b(bias|biased|discrimination|discriminatory|fairness when it comes to automated decisions)\b/ },
  { label: 'misinformation or manipulation framing', pattern: /\b(misinformation|disinformation|manipulat(?:e|es|ing|ion)|reshaping your opinions?|content moderation)\b/ },
  { label: 'surveillance or policing framing', pattern: /\b(surveillance|policing|criminal justice|predictive policing)\b/ },
  { label: 'military or weapons framing', pattern: /\b(weapon|weapons|military|war|nuclear|bomb|battlefield)\b/ },
  { label: 'regulation or compliance fight', pattern: /\b(eu ai act|regulatory requirements?|compliance status|audit-ready|fine-tuning|flops tracking|regulatory inquiries)\b/ },
  { label: 'AI environmental harm framing', pattern: /\b(energy consumption|environmental impacts?|unnecessary ai use|electricity on scales)\b/ },
  { label: 'market or funding framing', pattern: /\b(stock|shares|market cap|valuation|raises|funding round)\b/ },
  { label: 'generic vendor how-to', pattern: /\b(in this post,? we (show|demonstrate)|amazon bedrock|sagemaker|schema generation|intelligent document processing|knowledge base)\b/ },
  { label: 'unsupported or opinion framing', pattern: /\b(opinion|unsupported|speculat(?:e|ive|ion))\b/ },
]

const HUMAN_BENEFIT_DOMAIN_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'health care', pattern: /\b(health care|healthcare|medical|medicine|patients?|clinical|cancer|screening|diagnosis|hospital|mammograms?)\b/ },
  { label: 'accessibility', pattern: /\b(accessibility|assistive|blind|low vision|disabled|disability|captions?|screen reader|speech recognition)\b/ },
  { label: 'education', pattern: /\b(education|students?|teachers?|classroom|learners?|tutor|tutoring|course|ai fluency)\b/ },
  { label: 'science', pattern: /\b(science|researchers?|scientists?|materials?|biology|molecular|laboratory|drug discovery|open science)\b/ },
  { label: 'climate or energy', pattern: /\b(climate|weather|forecast|energy grid|renewable|wildfire|emissions|resilience)\b/ },
  { label: 'public service or safety', pattern: /\b(public service|public good|government|agency|community|emergency|infrastructure|roads?|bridges?|safety)\b/ },
  { label: 'small business', pattern: /\b(small business|local business|smb|entrepreneur|main street)\b/ },
  { label: 'creativity', pattern: /\b(creative|creator|artist|design|music|video|media|writing)\b/ },
]

const MINIMUM_PUBLIC_POSITIVITY_SCORE = 72
const MINIMUM_PUBLIC_CREDIBILITY_SCORE = 62

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
  const text = sourceAndContentText(input)
  const contentText = editorialText(input)
  const category = coerceGoodNewsCategory(input.category) ?? inferGoodNewsCategory(input)
  const categorySignals = CATEGORY_SIGNALS[category].filter(signal => contentText.includes(signal))
  const aiSignals = AI_RELEVANCE_SIGNALS.filter(signal => signal.pattern.test(contentText)).map(signal => signal.label)
  const benefitSignals = BENEFIT_SIGNALS.filter(signal => signal.pattern.test(contentText)).map(signal => signal.label)
  const evidenceSignals = EVIDENCE_SIGNALS.filter(signal => text.includes(signal))
  const strongSource = STRONG_SOURCE_SIGNALS.some(signal => text.includes(signal))
  const promotionalSignals = PROMOTIONAL_SIGNALS.filter(signal => contentText.includes(signal))
  const excludedSignals = EXCLUDED_SIGNALS.filter(signal => signal.pattern.test(contentText)).map(signal => signal.label)
  const humanBenefitDomains = HUMAN_BENEFIT_DOMAIN_SIGNALS.filter(signal => signal.pattern.test(contentText)).map(signal => signal.label)

  let positivity = 24
  positivity += Math.min(36, benefitSignals.length * 12)
  positivity += Math.min(14, categorySignals.length * 4)
  positivity += aiSignals.length > 0 ? 8 : 0
  positivity += humanBenefitDomains.length > 0 ? 10 : 0
  positivity += input.summary?.trim() ? 8 : 0
  positivity -= promotionalSignals.length > 0 ? 16 : 0
  positivity -= excludedSignals.length > 0 ? 55 : 0

  let credibility = 38
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
    ...(aiSignals.length === 0 ? ['No clear AI relevance signal.'] : []),
    ...(humanBenefitDomains.length === 0 ? ['No clear human-benefit domain.'] : []),
    ...(benefitSignals.length === 0 ? ['No clear positive good-news impact signal.'] : []),
    ...(credibility_score < MINIMUM_PUBLIC_CREDIBILITY_SCORE ? ['Credibility score below positive-good-news threshold.'] : []),
    ...(positivity_score < MINIMUM_PUBLIC_POSITIVITY_SCORE ? ['Positivity score below positive-good-news threshold.'] : []),
    ...(promotionalSignals.length > 0 ? ['Likely promotional or market-news framing.'] : []),
  ]

  return {
    accepted: rejection_reasons.length === 0,
    category,
    positivity_score,
    credibility_score,
    tags: suggestTags(input, category),
    evidence_notes: buildEvidenceNotes({
      sourceName: input.source_name,
      strongSource,
      aiSignals,
      humanBenefitDomains,
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

export function isHighRelevanceGoodNewsStory(story: GoodNewsStory): boolean {
  return scoreGoodNewsCandidate({
    title: story.title,
    source_name: story.source_name,
    source_url: story.source_url,
    canonical_url: story.canonical_url,
    published_at: story.published_at,
    discovered_at: story.discovered_at,
    summary: story.summary,
    content_text: `${story.summary} ${story.why_it_matters} ${story.evidence_notes}`,
    category: story.category,
    tags: story.tags,
  }).accepted
}

export function coerceGoodNewsCategory(value: string | null | undefined): GoodNewsCategory | null {
  return value && (GOOD_NEWS_CATEGORIES as readonly string[]).includes(value) ? value as GoodNewsCategory : null
}

export function inferGoodNewsCategory(input: GoodNewsCandidateInput): GoodNewsCategory {
  const text = editorialText(input)
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
  const text = sourceAndContentText(input)
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

function sourceAndContentText(input: GoodNewsCandidateInput): string {
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

function editorialText(input: GoodNewsCandidateInput): string {
  return [
    input.title,
    input.summary,
    input.content_text,
    input.category,
    ...(input.tags ?? []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function buildEvidenceNotes({
  sourceName,
  strongSource,
  aiSignals,
  humanBenefitDomains,
  benefitSignals,
  evidenceSignals,
  promotionalSignals,
}: {
  sourceName?: string | null
  strongSource: boolean
  aiSignals: string[]
  humanBenefitDomains: string[]
  benefitSignals: string[]
  evidenceSignals: string[]
  promotionalSignals: string[]
}): string {
  const parts = [
    sourceName ? `Source: ${sourceName}.` : 'Source name needs review.',
    strongSource ? 'Primary or high-credibility source signal found.' : 'Source credibility should be checked by an editor.',
    aiSignals.length > 0 ? `AI relevance signals: ${dedupeStrings(aiSignals).slice(0, 3).join(', ')}.` : 'AI relevance should be confirmed before publication.',
    humanBenefitDomains.length > 0 ? `Human-benefit domain: ${dedupeStrings(humanBenefitDomains).slice(0, 3).join(', ')}.` : 'Human-benefit domain should be confirmed before publication.',
    benefitSignals.length > 0 ? `Positive impact signals: ${dedupeStrings(benefitSignals).slice(0, 4).join(', ')}.` : 'No strong positive impact signal found.',
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
