import { NextResponse } from "next/server";
import * as na from "@/lib/nativeAuth";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

// POST /api/auth/reset-password
//   step "start":    { email }                          -> sends OTP
//   step "verify":   { continuationToken, otp }          -> returns next continuationToken
//   step "complete": { continuationToken, newPassword }  -> resets + auto signs in
export async function POST(request: Request) {
  if (!na.isNativeAuthConfigured()) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    if (body.step === "start") {
      if (!body.email) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 });
      }
      const challenge = await na.resetStart(body.email);
      return NextResponse.json({
        continuationToken: challenge.continuationToken,
        codeLength: challenge.codeLength,
        target: challenge.target,
      });
    }

    if (body.step === "verify") {
      const { continuationToken, otp } = body;
      if (!continuationToken || !otp) {
        return NextResponse.json({ error: "The code is required." }, { status: 400 });
      }
      const next = await na.resetSubmitOtp(continuationToken, otp);
      return NextResponse.json({ continuationToken: next });
    }

    if (body.step === "complete") {
      const { continuationToken, newPassword } = body;
      if (!continuationToken || !newPassword) {
        return NextResponse.json(
          { error: "A new password is required." },
          { status: 400 },
        );
      }
      const ct = await na.resetSubmitNewPassword(continuationToken, newPassword);
      // Try to sign the user straight in; if that fails they can log in manually.
      try {
        const claims = await na.exchangeContinuationToken(ct);
        const { role, onboardingComplete, ownsEstablishment } = await upsertUser(claims);
        const user = { ...claims, role, onboardingComplete, ownsEstablishment };
        const res = NextResponse.json({ ok: true, signedIn: true, user });
        res.cookies.set(SESSION_COOKIE, await encryptSession(user), sessionCookieOptions());
        return res;
      } catch {
        return NextResponse.json({ ok: true, signedIn: false });
      }
    }

    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  } catch (err) {
    if (err instanceof na.NativeAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: na.isServiceError(err) ? 503 : 400 },
      );
    }
    console.error("reset-password failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
