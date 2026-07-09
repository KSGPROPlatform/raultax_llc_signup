import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTaxReturn, computeTaxReturn } from "@/lib/tax";
import { activeTaxYear } from "@/lib/activeYear";
import { isAllowedTaxYear } from "@/lib/taxYear";

// GET /api/tax-return[?year=] — the USER-facing view of their computed return.
// Numbers are released only after the preparer approves (frozen): until then
// the user just sees the review status — preparer-first visibility rule.
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("year");
  const year = raw && isAllowedTaxYear(raw) ? Number(raw) : await activeTaxYear();
  const row = await getTaxReturn(user.sub, year);
  if (!row) return NextResponse.json({ taxYear: year, status: "none" });
  if (!row.frozen) return NextResponse.json({ taxYear: year, status: "in_review" });
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  // Approved: release the headline numbers (overrides win when present).
  const ov = (row.overrides ?? {}) as Record<string, { value?: number }>;
  const eff = (k: string) => num(ov[k]?.value) ?? num(row[k]);
  return NextResponse.json({
    taxYear: year,
    status: "approved",
    total_tax: eff("line_24"),
    total_payments: eff("line_33"),
    refund: eff("line_34"),
    owed: eff("line_37"),
  });
}

// POST /api/tax-return — recompute the active year's 1040 from current data
// (refused server-side when the return is frozen).
export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = await activeTaxYear();
  const result = await computeTaxReturn(user.sub, year);
  if (!result) return NextResponse.json({ error: "Computation failed." }, { status: 502 });
  // Users never see raw lines pre-approval; just acknowledge.
  return NextResponse.json({ taxYear: year, computed: Boolean(result.computed), frozen: Boolean(result.frozen) });
}
