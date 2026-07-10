import { NextResponse } from "next/server";
import * as na from "@/lib/nativeAuth";
import { validateEmail } from "@/lib/validation";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

// POST /api/auth/signin  { email, password }
export async function POST(request: Request) {
  if (!na.isNativeAuthConfigured()) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const { email, password } = body;
  const emailErr = email ? validateEmail(String(email)) : null;
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  try {
    const claims = await na.signin(email, password);
    const { role, onboardingComplete, ownsEstablishment } = await upsertUser(claims);
    const user = { ...claims, role, onboardingComplete, ownsEstablishment };
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(SESSION_COOKIE, await encryptSession(user), sessionCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof na.NativeAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: na.isServiceError(err) ? 503 : 401 },
      );
    }
    console.error("signin failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
