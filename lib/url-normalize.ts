// ─── URL normalization ──────────────────────────────────────────────────────────
// Canonicalize URLs so the same article shared with different tracking params,
// www prefix, fragment, or trailing slash all compare equal.
//
// Used by the known-urls index to prevent re-importing articles already
// published in recent issues.

const TRACKING_PARAMS_TO_STRIP = [
  // Standard UTM
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  // Social referrer params
  'fbclid', 'gclid', 'dclid', 'msclkid', 'twclid', 'yclid', 'igshid',
  // Mailchimp + other email platforms
  'mc_cid', 'mc_eid', 'mkt_tok',
  // Generic referrer params
  'ref', 'ref_src', 'ref_url', 'source', 'src',
  // Hubspot / Salesforce
  '_hsenc', '_hsmi', 'hsCtaTracking',
]

/**
 * Returns a canonical form of the URL suitable for equality comparison.
 * If parsing fails, falls back to the trimmed lowercase original.
 */
export function normalizeUrl(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()
  try {
    const u = new URL(trimmed)

    // Lowercase scheme + host, strip "www." prefix
    u.protocol = u.protocol.toLowerCase()
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')

    // Strip tracking query params
    for (const p of TRACKING_PARAMS_TO_STRIP) u.searchParams.delete(p)

    // Drop the fragment
    u.hash = ''

    // Build the canonical form, then strip a single trailing slash from the
    // path (but keep the slash if path is just "/")
    let out = u.toString()
    if (out.endsWith('/') && u.pathname !== '/') out = out.slice(0, -1)
    return out
  } catch {
    return trimmed.toLowerCase()
  }
}
