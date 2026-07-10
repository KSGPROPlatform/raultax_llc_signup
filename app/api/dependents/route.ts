import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDependents, saveDependent, revertSubmissionToDraft } from "@/lib/profileData";
import { validateDependentInput, optionalId } from "@/lib/serverValidate";
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
  const idCheck = optionalId(body.id);
  const checked = idCheck.error ? { error: idCheck.error } : validateDependentInput(body);
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const row = await saveDependent(
      user.sub,
      { id: idCheck.id, ...checked.data! },
      await activeTaxYear(),
    );
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
