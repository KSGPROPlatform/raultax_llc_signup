import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTaxReturn, computeTaxReturn } from "@/lib/tax";
import { activeTaxYear } from "@/lib/activeYear";

// GET /api/tax-return — the stored computed 1040 for the active year (or null).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = await activeTaxYear();
  const row = await getTaxReturn(user.sub, year);
  return NextResponse.json({ taxYear: year, return: row });
}

// POST /api/tax-return — recompute the active year's 1040 from current data
// (refused server-side when the return is frozen).
export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = await activeTaxYear();
  const result = await computeTaxReturn(user.sub, year);
  if (!result) return NextResponse.json({ error: "Computation failed." }, { status: 502 });
  return NextResponse.json({ taxYear: year, ...result });
}
