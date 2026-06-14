import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// TEMPORARY diagnostic — remove after we confirm the app->function call works.
// Visit /api/auth/debug while signed in. It reports whether the SWA runtime has
// the PROFILE_API_* env vars and what the function returns when the app calls it
// with your real session claims (this also writes your real row if it succeeds).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first, then reload." }, { status: 401 });
  }

  const base = process.env.PROFILE_API_URL;
  const key = process.env.PROFILE_API_KEY;

  const out: Record<string, unknown> = {
    runtimeHasBaseUrl: Boolean(base),
    baseUrl: base ?? null,
    runtimeHasKey: Boolean(key),
    keyLength: key ? key.length : 0,
    sessionSub: session.sub,
  };

  if (base) {
    const url =
      `${base.replace(/\/$/, "")}/upsertUser` +
      (key ? `?code=${encodeURIComponent(key)}` : "");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oid: session.sub,
          email: session.email,
          name: session.name,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      out.callStatus = res.status;
      out.callBody = (await res.text()).slice(0, 600);
    } catch (err) {
      out.callError =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
  }

  return NextResponse.json(out);
}
