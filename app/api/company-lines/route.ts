import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCompanyLines, saveCompanyLine, revertSubmissionToDraft } from "@/lib/profileData";
import { validateCompanyLineInput, optionalId } from "@/lib/serverValidate";
import { activeTaxYear } from "@/lib/activeYear";

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
  const idCheck = optionalId(body.id);
  const checked = idCheck.error ? { error: idCheck.error } : validateCompanyLineInput(body);
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const row = await saveCompanyLine(user.sub, {
      id: idCheck.id,
      companyId,
      ...checked.data!,
    });
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
