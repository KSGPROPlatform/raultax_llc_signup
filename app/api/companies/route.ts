import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCompanies, saveCompany } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// GET /api/companies — the signed-in user's companies for the active tax year.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listCompanies(user.sub, await activeTaxYear());
  return NextResponse.json({ rows });
}

// POST /api/companies — create (no id) or update (with id) one company,
// stamped with the active tax year.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const row = await saveCompany(
      user.sub,
      {
        id: body.id,
        company_name: body.company_name ?? "",
        ein: body.ein ?? "",
        activities: body.activities ?? "",
      },
      await activeTaxYear(),
    );
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
