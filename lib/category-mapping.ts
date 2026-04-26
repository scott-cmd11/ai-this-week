// ─── Category mapping ──────────────────────────────────────────────────────────
// Rolls up the many narrow section names from each briefing source
// (e.g. "Federal Government AI Adoption", "AI Coding", "AI & Wheat") into
// a small fixed taxonomy that's easier to scan in the admin import panel.
//
// Used only client-side in the BriefingImport component — does not affect
// the published issue or the Notion data on disk.

export type Category =
  | 'Canada'
  | 'Policy & Regulation'
  | 'Government & Public Sector'
  | 'Industry & Models'
  | 'Sectors & Applications'

/** Display order for category sections in the admin UI. */
export const CATEGORY_ORDER: Category[] = [
  'Canada',
  'Policy & Regulation',
  'Government & Public Sector',
  'Industry & Models',
  'Sectors & Applications',
]

/** Per-category icon + short tagline for headers in the admin UI. */
export const CATEGORY_META: Record<Category, { icon: string; tagline: string }> = {
  'Canada': { icon: '🍁', tagline: 'Canadian AI policy, companies, and adoption' },
  'Policy & Regulation': { icon: '⚖️', tagline: 'Privacy, ethics, governance, regulation' },
  'Government & Public Sector': { icon: '🏛️', tagline: 'Federal use, public-sector AI, sovereign compute' },
  'Industry & Models': { icon: '💼', tagline: 'Investment, M&A, models, agents, coding, ASI/AGI' },
  'Sectors & Applications': { icon: '🌾', tagline: 'Agriculture, environment, jobs, applied AI' },
}

/**
 * Map a (sourceLabel, sectionName) pair to one canonical category.
 * First matching rule wins — more specific rules listed first.
 *
 * Both inputs are matched case-insensitively against substring patterns.
 * Designed to be defensive: any unknown section name falls into
 * "Industry & Models" so it still shows up somewhere.
 */
export function categorize(sourceLabel: string, sectionName: string): Category {
  const s = sectionName.toLowerCase()
  const src = sourceLabel.toLowerCase()

  // Canada wins first — the newsletter is Canadian-focused, so Canadian-AI
  // stories should bubble to the top even when they're also "policy" or
  // "government" stories elsewhere.
  if (s.includes('canad')) return 'Canada'

  // Sectoral / applied AI — agriculture, environment, jobs, etc.
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
    s.includes('health')
  ) {
    return 'Sectors & Applications'
  }

  // Whole-source fallback for the Agriculture briefing in case a section
  // name doesn't match the keywords above.
  if (src.includes('agricultur')) return 'Sectors & Applications'

  // Policy / governance / ethics / privacy / regulation
  if (
    s.includes('regulation') ||
    s.includes('policy') ||
    s.includes('privacy') ||
    s.includes('governance') ||
    s.includes('ethic')
  ) {
    return 'Policy & Regulation'
  }

  // Government, public sector, sovereign compute
  if (
    s.includes('public sector') ||
    s.includes('government') ||
    s.includes('sovereign') ||
    s.includes('compute')
  ) {
    return 'Government & Public Sector'
  }

  // Default catch-all — investment, models, agents, coding, security, ASI/AGI…
  return 'Industry & Models'
}
