import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";
import { createDeclaration, revertSubmissionToDraft } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// POST /api/profile/establishment  { owns: boolean }
// Persists the "do you own an establishment?" answer — PER YEAR on the active
// declaration (the source of truth; answering "No" completes the Business
// section for that year) — and re-mints the session flag for legacy displays.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const owns = Boolean(body.owns);

  try {
    await createDeclaration(user.sub, await activeTaxYear(), {
      owns_establishment: owns,
    });
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
  } catch (err) {
    console.error("establishment declaration save failed:", err);
  }

  const { role } = await upsertUser(user, undefined, { owns_establishment: owns });
  const updated = { ...user, role, ownsEstablishment: owns };
  const res = NextResponse.json({ ok: true, owns });
  res.cookies.set(SESSION_COOKIE, await encryptSession(updated), sessionCookieOptions());
  return res;
}
