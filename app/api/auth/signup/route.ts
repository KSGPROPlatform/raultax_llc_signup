import { NextResponse } from "next/server";
import * as na from "@/lib/nativeAuth";
import { upsertUser } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";

// POST /api/auth/signup
//   step "start":  { email, password }  -> sends OTP, returns continuationToken
//   step "verify": { continuationToken, otp, password } -> creates user, signs in
//
// The continuation token round-trips to the client between the two steps (it's a
// short-lived flow token, not a session). The session cookie is set only at the
// very end, after Entra issues tokens.
export async function POST(request: Request) {
  if (!na.isNativeAuthConfigured()) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    if (body.step === "start") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required." },
          { status: 400 },
        );
      }
      // Sign-up collects only email + password. The name and rich profile are
      // gathered later (Personal info is the first onboarding step).
      const ct = await na.signupStart(email, password);
      const challenge = await na.signupChallenge(ct);
      return NextResponse.json({
        continuationToken: challenge.continuationToken,
        codeLength: challenge.codeLength,
        target: challenge.target,
      });
    }

    if (body.step === "verify") {
      const { continuationToken, otp, password } = body;
      if (!continuationToken || !otp) {
        return NextResponse.json(
          { error: "The verification code is required." },
          { status: 400 },
        );
      }

      // Submit the OTP, then satisfy whatever Entra still asks for (password /
      // attributes) until the flow completes with a clean continuation token.
      let resp = await na.signupContinueOob(continuationToken, otp);
      for (let i = 0; i < 4 && resp.error; i++) {
        if (resp.error === "credential_required" && resp.continuation_token && password) {
          resp = await na.signupContinuePassword(resp.continuation_token, password);
        } else if (resp.error === "attributes_required" && resp.continuation_token) {
          // No attributes are collected at sign-up (name comes later in
          // onboarding), so satisfy the prompt with an empty set.
          resp = await na.signupContinueAttributes(resp.continuation_token, {});
        } else {
          break;
        }
      }
      if (resp.error || !resp.continuation_token) {
        return NextResponse.json(
          { error: resp.error_description || "Could not complete sign-up." },
          { status: 400 },
        );
      }

      const claims = await na.exchangeContinuationToken(resp.continuation_token);
      // Create the user row (and resolve the role) with no profile yet — the
      // name stays empty until Personal info is completed in onboarding.
      const { role, ownsEstablishment } = await upsertUser(claims);
      // A brand-new account always starts with onboarding incomplete, regardless
      // of what the upsert echoes back.
      const user = {
        ...claims,
        name: claims.name || "",
        role,
        onboardingComplete: false,
        ownsEstablishment,
      };
      const res = NextResponse.json({ ok: true, user });
      res.cookies.set(SESSION_COOKIE, await encryptSession(user), sessionCookieOptions());
      return res;
    }

    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  } catch (err) {
    if (err instanceof na.NativeAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: na.isServiceError(err) ? 503 : 400 },
      );
    }
    console.error("signup failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
