// The active tax-year context. A declaration = (user, tax year); the selected
// year lives in an httpOnly cookie set by /api/declarations and is read
// server-side by the upload/list routes so documents are stamped and filtered
// by the year being declared.

export const TAX_YEAR_COOKIE = "rt_tax_year";

// Sliding window of declarable TAX years. You can only declare a COMPLETED
// year: during 2026 you file the 2025 return — so the list is the last
// finished year + 3 back (2026 -> 2025, 2024, 2023, 2022), matching the IRS
// refund-claim window. Recomputed from the clock, so it advances every January.
export function allowedTaxYears(now = new Date().getFullYear()): number[] {
  const latest = now - 1;
  return [latest, latest - 1, latest - 2, latest - 3];
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
