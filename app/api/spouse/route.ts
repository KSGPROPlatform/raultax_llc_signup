import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSpouse, saveSpouse, type SpouseInput } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// GET /api/spouse — the signed-in user's spouse for the active tax year (or null).
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const spouse = await getSpouse(user.sub, await activeTaxYear());
  return NextResponse.json({ spouse });
}

// POST /api/spouse — upsert the spouse. Only the fields present in the body are
// forwarded, so the MFS "SSN only" save doesn't clear a previously-saved record.
const FIELDS: (keyof SpouseInput)[] = [
  "first_name",
  "last_name",
  "date_of_birth",
  "ssn",
  "street_address",
  "city",
  "state_province",
  "postal_code",
];

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: SpouseInput = {};
  for (const f of FIELDS) {
    if (typeof body[f] === "string") data[f] = body[f] as string;
  }
  try {
    const spouse = await saveSpouse(user.sub, data, await activeTaxYear());
    return NextResponse.json({ spouse });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
