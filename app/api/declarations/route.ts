import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { listDeclarations, createDeclaration } from "@/lib/profileData";
import { TAX_YEAR_COOKIE, isAllowedTaxYear, resolveTaxYear } from "@/lib/taxYear";
import { computeTaxReturn } from "@/lib/tax";

// GET /api/declarations — the user's declarations + the currently selected tax
// year (from the httpOnly cookie, clamped to the allowed window).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();
  const selectedYear = resolveTaxYear(jar.get(TAX_YEAR_COOKIE)?.value);
  const rows = await listDeclarations(user.sub);
  return NextResponse.json({ rows, selectedYear });
}

// POST /api/declarations { taxYear, status? } — start (or re-select) that
// year's declaration and make it the active year. Idempotent. Submitting
// (status: "submitted") is gated on completeness and triggers the 1040
// computation so the preparer sees fresh numbers.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    taxYear?: unknown;
    status?: unknown;
  };
  if (!isAllowedTaxYear(body.taxYear)) {
    return NextResponse.json({ error: "That tax year isn't available." }, { status: 400 });
  }
  const taxYear = Number(body.taxYear);
  const submitting = body.status === "submitted";

  try {
    if (submitting) {
      // Completeness gate: a submitted declaration must be computable.
      const d = (await listDeclarations(user.sub)).find((r) => r.tax_year === taxYear);
      const problems: string[] = [];
      if (!d) {
        problems.push("Start the declaration first.");
      } else {
        const fs = (d.filing_status ?? "").trim();
        if (!fs) problems.push("Complete your Personal information.");
        const needsSpouse = fs === "Married filing jointly" || fs === "Married filing separately";
        if (needsSpouse && !(d.spouse ?? 0)) problems.push("Add your spouse's information.");
        if (!(d.bank_accounts ?? 0)) problems.push("Add a bank account for your refund.");
        if (!((d.companies ?? 0) > 0 || d.owns_establishment === false)) {
          problems.push("Answer the establishment question (and add your company if yes).");
        }
      }
      if (problems.length) {
        return NextResponse.json(
          { error: `Cannot submit yet — ${problems.join(" ")}` },
          { status: 400 },
        );
      }
    }

    const row = await createDeclaration(
      user.sub,
      taxYear,
      submitting ? { status: "submitted" } : undefined,
    );
    if (submitting) {
      // Fresh numbers for the preparer's review (best-effort; freeze respected).
      await computeTaxReturn(user.sub, taxYear);
    }
    const res = NextResponse.json({ row, selectedYear: taxYear });
    res.cookies.set(TAX_YEAR_COOKIE, String(taxYear), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the declaration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
