import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { listDeclarations, createDeclaration } from "@/lib/profileData";
import { TAX_YEAR_COOKIE, isAllowedTaxYear, resolveTaxYear } from "@/lib/taxYear";

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

// POST /api/declarations { taxYear } — start (or re-select) that year's
// declaration and make it the active year. Idempotent.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { taxYear?: unknown };
  if (!isAllowedTaxYear(body.taxYear)) {
    return NextResponse.json({ error: "That tax year isn't available." }, { status: 400 });
  }
  const taxYear = Number(body.taxYear);
  try {
    const row = await createDeclaration(user.sub, taxYear);
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
