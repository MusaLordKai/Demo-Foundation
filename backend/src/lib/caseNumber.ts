/**
 * Case number format: SHORTCODE-MM-YY-NNN
 *   - SHORTCODE: the grant's 3-letter code
 *   - MM: 2-digit month, YY: last 2 digits of the year
 *   - NNN: random 3-digit suffix (100–999)
 * e.g. SPT-06-26-482
 *
 * Pure (no DB). The service wraps this with a uniqueness retry.
 */
export function generateCaseNumber(shortCode: string, date: Date, rng: () => number = Math.random): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const nnn = String(100 + Math.floor(rng() * 900));
  return `${shortCode.toUpperCase()}-${mm}-${yy}-${nnn}`;
}

/** Validates the SHORTCODE-MM-YY-NNN shape (used in tests). */
export const CASE_NUMBER_RE = /^[A-Z]{3}-\d{2}-\d{2}-\d{3}$/;
