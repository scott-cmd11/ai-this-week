// ─── Category mapping ──────────────────────────────────────────────────────────
// Rolls up the many narrow section names from each briefing source
// (e.g. "Federal Government AI Adoption", "AI Coding", "AI & Wheat") into
// a small fixed taxonomy that's easier to scan in the admin import panel.
//
// Used both client-side (BriefingImport pre-checks rule output and lets the
// editor override per-article) and server-side (the chosen category becomes
// the h2 section the article lands in inside the published issue).

export type Category =
  | 'Canada'
  | 'Policy & Regulation'
  | 'Government & Public Sector'
  | 'Industry & Models'
  | 'Sectors & Applications'
  | 'Research'

/** Display order for category sections in the admin UI. */
export const CATEGORY_ORDER: Category[] = [
  'Canada',
  'Policy & Regulation',
  'Government & Public Sector',
  'Industry & Models',
  'Sectors & Applications',
  'Research',
]

export function categoryOrderRank(label: string): number | null {
  const index = CATEGORY_ORDER.indexOf(label as Category)
  return index === -1 ? null : index
}

const CANADA_ARTICLE_SIGNALS = [
  'canada',
  'canadian',
  'ottawa',
  'winnipeg',
  'manitoba',
  'toronto',
  'vancouver',
  'calgary',
  'montreal',
  'british columbia',
  'alberta',
  'saskatchewan',
  'ontario',
  'quebec',
  'cbc.ca',
  'global news',
  'globe and mail',
  'ipolitics',
  'canada.ca',
  'gc.ca',
  'sencanada',
]

const RESEARCH_SIGNALS = [
  'research',
  'paper',
  'arxiv',
  'benchmark',
  'nserc',
  'natural sciences and engineering research council',
]

const POLICY_SIGNALS = [
  'regulation',
  'regulator',
  'policy',
  'privacy',
  'governance',
  'ethic',
  'copyright',
  'intellectual property',
  'cybersecurity',
  'cyber security',
  'data breach',
  'privilege',
  'audit',
  'public interest',
]

const GOVERNMENT_SIGNALS = [
  'public sector',
  'government',
  'federal',
  'municipal',
  'provincial',
  'sovereign',
  'minister',
  'bank of canada',
  'canada.ca',
  'gc.ca',
]

const SECTOR_SIGNALS = [
  'agricultur',
  'grain',
  'crop',
  'wheat',
  'oilseed',
  'livestock',
  'environment',
  'climate',
  'job',
  'workforce',
  'health',
  'doctor',
  'medical',
  'education',
  'universit',
  'legal',
]

const INDUSTRY_SIGNALS = [
  'data centre',
  'data center',
  'compute',
  'infrastructure',
  'investment',
  'funding',
  'company',
  'startup',
  'enterprise',
  'productivity',
  'model',
  'llm',
  'agent',
  'coding',
  'developer',
  'm&a',
  'merger',
  'acquisition',
  'chip',
  'gpu',
]

interface ArticleCategoryInput {
  title?: string | null
  summary?: string | null
  annotation?: string | null
  url?: string | null
  source?: string | null
  sourceLabel?: string | null
  category?: string | null
}

function validCategory(value: string | null | undefined): Category | null {
  return value && CATEGORY_ORDER.includes(value as Category) ? value as Category : null
}

function articleCategoryText(input: ArticleCategoryInput): string {
  return [
    input.title,
    input.summary,
    input.annotation,
    input.url,
    input.source,
    input.sourceLabel,
    input.category,
  ].filter(Boolean).join(' ').toLowerCase()
}

function hasCanadianHost(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.endsWith('.ca') || hostname.includes('.gc.ca')
  } catch {
    return false
  }
}

function hasAnySignal(text: string, signals: string[]): boolean {
  return signals.some(signal => text.includes(signal))
}

function topicalCategoryForArticle(input: ArticleCategoryInput): Category | null {
  const text = articleCategoryText(input)
  if (hasAnySignal(text, RESEARCH_SIGNALS)) return 'Research'
  if (hasAnySignal(text, POLICY_SIGNALS)) return 'Policy & Regulation'
  if (hasAnySignal(text, GOVERNMENT_SIGNALS)) return 'Government & Public Sector'
  if (hasAnySignal(text, SECTOR_SIGNALS)) return 'Sectors & Applications'
  if (hasAnySignal(text, INDUSTRY_SIGNALS)) return 'Industry & Models'
  return null
}

export function isCanadaMention(input: ArticleCategoryInput): boolean {
  const text = articleCategoryText(input)
  return hasCanadianHost(input.url) || CANADA_ARTICLE_SIGNALS.some(signal => text.includes(signal))
}

export function categoryForArticle(
  input: ArticleCategoryInput,
  fallbackCategory?: Category | string | null,
): Category {
  const topicalCategory = topicalCategoryForArticle(input)
  if (topicalCategory) return topicalCategory
  const validFallback = validCategory(fallbackCategory) ?? validCategory(input.category)
  if (validFallback && validFallback !== 'Canada') return validFallback
  if (isCanadaMention(input)) return 'Canada'
  return validFallback ?? 'Industry & Models'
}

// ─── Section name alternates ────────────────────────────────────────────────────
// "Industry & Models" mashes a lot together; "Sectors & Applications" is
// awkward. To switch, replace the corresponding label in CATEGORY_ORDER and
// CATEGORY_META, plus the literal type union above.
//
// Industry & Models alternates:
//   Option A: "Industry, Models & Tools"
//   Option B: "Models, Tools & Industry"
//
// Sectors & Applications alternates:
//   Option A: "Applied AI"
//   Option B: "Sectors & Use Cases"

/** Per-category section code + short tagline for headers in the admin UI. */
export const CATEGORY_META: Record<Category, { icon: string; tagline: string }> = {
  'Canada': { icon: 'CAN', tagline: 'Canadian AI policy, companies, and adoption' },
  'Policy & Regulation': { icon: 'POL', tagline: 'Privacy, ethics, governance, regulation' },
  'Government & Public Sector': { icon: 'GOV', tagline: 'Federal use, public-sector AI, sovereign compute' },
  'Industry & Models': { icon: 'IND', tagline: 'Investment, M&A, models, agents, coding, ASI/AGI' },
  'Sectors & Applications': { icon: 'APP', tagline: 'Agriculture, environment, jobs, applied AI' },
  'Research': { icon: 'RES', tagline: 'Trending AI research papers from arXiv and Hugging Face' },
}

/**
 * Map a (sourceLabel, sectionName) pair to one canonical category.
 * First matching rule wins — more specific rules listed first.
 *
 * Both inputs are matched case-insensitively against substring patterns.
 * Anything not matched falls into "Industry & Models" — but with the
 * keyword sets below, that bucket should be hit only by genuine misses,
 * not by the long tail of common AI section names.
 *
 * Editors can override per-article in the admin BriefingImport panel,
 * so the rules don't need to be perfect — they just need to be a good
 * default for most stories.
 */
export function categorize(sourceLabel: string, sectionName: string): Category {
  const s = sectionName.toLowerCase()
  const src = sourceLabel.toLowerCase()

  // Canada wins first — the newsletter is Canadian-focused, so Canadian-AI
  // stories should bubble to the top even when they're also "policy" or
  // "government" stories elsewhere. Trade-off: a "Canadian AI Research"
  // section will land under Canada (not Research), which is usually right
  // for editorial framing. Use the per-article override when it isn't.
  // Research sources and benchmark/paper sections should not be hidden in
  // the broader Industry & Models bucket.
  if (
    s.includes('research') ||
    s.includes('paper') ||
    s.includes('arxiv') ||
    s.includes('benchmark') ||
    src.includes('research')
  ) {
    return 'Research'
  }

  // Sectoral / applied AI — agriculture, environment, jobs, health, etc.
  if (
    s.includes('agricultur') ||
    s.includes('grain') ||
    s.includes('crop') ||
    s.includes('wheat') ||
    s.includes('oilseed') ||
    s.includes('livestock') ||
    s.includes('environment') ||
    s.includes('climate') ||
    s.includes('job') ||
    s.includes('replacement') ||
    s.includes('health') ||
    s.includes('medic') ||
    s.includes('education') ||
    s.includes('legal')
  ) {
    return 'Sectors & Applications'
  }

  // Whole-source fallback for the Agriculture briefing in case a section
  // name doesn't match the keywords above.
  if (src.includes('agricultur')) return 'Sectors & Applications'

  // Policy / governance / ethics / privacy / regulation
  if (
    s.includes('regulation') ||
    s.includes('regulator') ||
    s.includes('policy') ||
    s.includes('privacy') ||
    s.includes('governance') ||
    s.includes('ethic') ||
    s.includes('copyright') ||
    s.includes('intellectual property')
  ) {
    return 'Policy & Regulation'
  }

  // Government, public sector, sovereign compute — note "compute" alone
  // is now in Industry, since most "AI compute" stories are infrastructure;
  // "sovereign compute" still lands here via the "sovereign" rule.
  if (
    s.includes('public sector') ||
    s.includes('government') ||
    s.includes('federal') ||
    s.includes('municipal') ||
    s.includes('provincial') ||
    s.includes('sovereign') ||
    s.includes('military') ||
    s.includes('defence') ||
    s.includes('defense')
  ) {
    return 'Government & Public Sector'
  }

  // Industry & Models — explicit rules so this isn't just a catch-all.
  // Covers: model releases, agents, coding tools, funding/M&A, security,
  // safety/alignment, ASI/AGI, enterprise adoption, infrastructure.
  if (
    s.includes('model') ||
    s.includes('llm') ||
    s.includes('agent') ||
    s.includes('coding') ||
    s.includes('developer') ||
    s.includes('funding') ||
    s.includes('investment') ||
    s.includes(' vc ') || s.startsWith('vc ') || s.endsWith(' vc') ||
    s.includes('m&a') ||
    s.includes('merger') ||
    s.includes('acquisition') ||
    s.includes('startup') ||
    s.includes('enterprise') ||
    s.includes('security') ||
    s.includes('cyber') ||
    s.includes('safety') ||
    s.includes('alignment') ||
    s.includes('agi') ||
    s.includes('asi') ||
    s.includes('compute') ||
    s.includes('infrastructure') ||
    s.includes('chip') ||
    s.includes('gpu')
  ) {
    return 'Industry & Models'
  }

  // Default catch-all — anything that didn't match above. With the rules
  // expanded this should be rare; when it happens, the editor can always
  // pick a different category via the per-article override.
  if (s.includes('canad')) return 'Canada'
  return 'Industry & Models'
}
