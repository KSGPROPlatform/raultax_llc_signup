import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDependents, saveDependent } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// GET /api/dependents — the signed-in user's dependents for the active tax year.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listDependents(user.sub, await activeTaxYear());
  return NextResponse.json({ rows });
}

// POST /api/dependents — create (no id) or update (with id) one dependent,
// stamped with the active tax year.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const row = await saveDependent(
      user.sub,
      {
        id: body.id,
        full_name: body.full_name ?? "",
        ssn: body.ssn ?? "",
        date_of_birth: body.date_of_birth ?? "",
        relationship: body.relationship ?? "",
      },
      await activeTaxYear(),
    );
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
