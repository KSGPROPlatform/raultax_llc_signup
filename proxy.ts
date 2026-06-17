import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decryptSession } from "@/lib/session";

// Edge gate (Next 16 "proxy" convention, formerly middleware): runs before any
// /dashboard page renders. No valid session cookie => redirect to /login
// (preserving where they were headed). Verifies the cookie with jose
// (Edge-safe — no DB, no Node APIs).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await decryptSession(token);

  if (!user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
