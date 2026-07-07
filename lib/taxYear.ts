// The active tax-year context. A declaration = (user, tax year); the selected
// year lives in an httpOnly cookie set by /api/declarations and is read
// server-side by the upload/list routes so documents are stamped and filtered
// by the year being declared.

export const TAX_YEAR_COOKIE = "rt_tax_year";

// Sliding window: the current year + 3 back (2026 -> 2023–2026), matching the
// IRS refund-claim window. Recomputed from the clock, so it advances itself.
export function allowedTaxYears(now = new Date().getFullYear()): number[] {
  return [now, now - 1, now - 2, now - 3];
}

// Clamp any raw value (cookie, request body) to the allowed window; default to
// the current year.
export function resolveTaxYear(raw: unknown): number {
  const years = allowedTaxYears();
  const n = Number(raw);
  return years.includes(n) ? n : years[0];
}

export function isAllowedTaxYear(raw: unknown): boolean {
  return allowedTaxYears().includes(Number(raw));
}
