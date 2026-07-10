import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSpouse, saveSpouse, revertSubmissionToDraft, type SpouseInput } from "@/lib/profileData";
import { validateSpouseInput } from "@/lib/serverValidate";
import { activeTaxYear } from "@/lib/activeYear";
import { cardConsistencyError } from "@/lib/identity";

// GET /api/spouse — the signed-in user's spouse for the active tax year (or null).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const spouse = await getSpouse(user.sub, await activeTaxYear());
  return NextResponse.json({ spouse });
}

// POST /api/spouse — upsert the spouse. Only the fields present in the body are
// forwarded (so the MFS "SSN only" save doesn't clear a previously-saved
// record), and every present field is validated server-side.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const checked = validateSpouseInput(body);
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  const data: SpouseInput = checked.data!;
  // Save-time guard: the spouse identity being saved must match the verified
  // spouse SSN card already on file.
  const conflict = await cardConsistencyError(user.sub, "spouse_ssn_copy", {
    name: [data.first_name, data.last_name].filter(Boolean).join(" "),
    ssn: data.ssn,
  });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });

  try {
    const spouse = await saveSpouse(user.sub, data, await activeTaxYear());
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
    return NextResponse.json({ spouse });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
