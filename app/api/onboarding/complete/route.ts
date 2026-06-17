import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

// POST /api/onboarding/complete — marks the onboarding journey finished and
// re-mints the session so the dashboard gate stops redirecting back here.
export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, ownsEstablishment } = await upsertUser(user, undefined, {
    onboarding_completed: true,
  });
  const updated = { ...user, role, ownsEstablishment, onboardingComplete: true };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await encryptSession(updated), sessionCookieOptions());
  return res;
}
