import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCompanyLines, saveCompanyLine } from "@/lib/profileData";

// GET /api/company-lines?companyId= — the signed-in user's P&L lines for a company.
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = Number(new URL(request.url).searchParams.get("companyId"));
  if (!Number.isInteger(companyId)) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const rows = await listCompanyLines(user.sub, companyId);
  return NextResponse.json({ rows });
}

// POST /api/company-lines — create (no id) or update (with id) one P&L line.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const companyId = Number(body.companyId);
  if (!Number.isInteger(companyId)) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const raw = body.amount;
  const amount = raw === "" || raw === null || raw === undefined ? 0 : Number(raw);
  try {
    const row = await saveCompanyLine(user.sub, {
      id: body.id,
      companyId,
      kind: body.kind === "income" ? "income" : "expense",
      category: body.category ?? "",
      description: body.description ?? "",
      amount: Number.isFinite(amount) ? Math.abs(amount) : 0,
    });
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
