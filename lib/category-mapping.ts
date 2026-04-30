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

/** Per-category icon + short tagline for headers in the admin UI. */
export const CATEGORY_META: Record<Category, { icon: string; tagline: string }> = {
  'Canada': { icon: '🍁', tagline: 'Canadian AI policy, companies, and adoption' },
  'Policy & Regulation': { icon: '⚖️', tagline: 'Privacy, ethics, governance, regulation' },
  'Government & Public Sector': { icon: '🏛️', tagline: 'Federal use, public-sector AI, sovereign compute' },
  'Industry & Models': { icon: '💼', tagline: 'Investment, M&A, models, agents, coding, ASI/AGI' },
  'Sectors & Applications': { icon: '🌾', tagline: 'Agriculture, environment, jobs, applied AI' },
  'Research': { icon: '🔬', tagline: 'Trending AI research papers from arXiv and Hugging Face' },
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
  if (s.includes('canad')) return 'Canada'

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
  return 'Industry & Models'
}
