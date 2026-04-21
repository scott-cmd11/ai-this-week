/**
 * Keeps the date portion of an issue title together so it doesn't
 * wrap between "Apr" and "27," or "27," and "2026" when rendered in
 * large-display headlines like "AI THIS WEEK — APR 27, 2026".
 *
 * Replaces the two spaces inside the date with NO-BREAK SPACE (U+00A0)
 * so the browser still breaks after the em-dash but keeps the date glued.
 *
 * "AI This Week — Apr 27, 2026" → "AI This Week — Apr\u00A027,\u00A02026"
 */
export function nonBreakingDate(title: string): string {
  return title.replace(/([A-Z][a-z]+) (\d+), (\d{4})/, '$1\u00A0$2,\u00A0$3')
}
