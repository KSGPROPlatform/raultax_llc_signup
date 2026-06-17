import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

// POST /api/profile/establishment  { owns: boolean }
// Persists the "do you own an establishment?" answer and re-mints the session
// so the dashboard reflects it immediately.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const owns = Boolean(body.owns);

  const { role } = await upsertUser(user, undefined, { owns_establishment: owns });
  const updated = { ...user, role, ownsEstablishment: owns };
  const res = NextResponse.json({ ok: true, owns });
  res.cookies.set(SESSION_COOKIE, await encryptSession(updated), sessionCookieOptions());
  return res;
}
