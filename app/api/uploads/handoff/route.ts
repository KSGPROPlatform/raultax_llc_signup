import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { createUploadToken, UPLOAD_TOKEN_MAX_AGE } from "@/lib/uploadToken";

// GET /api/uploads/handoff — (authenticated) mints a short-lived upload-only
// token and returns a QR code the user scans to continue uploading on their
// phone. The token encodes the user's oid; the phone needs no login.
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await createUploadToken(user.sub);

  // Prefer the origin the BROWSER is actually on (sent by the client) — it is
  // the authoritative public URL. Behind Azure Static Web Apps the server-side
  // `host`/`x-forwarded-host` headers are not reliably the public domain, which
  // would otherwise produce a QR the phone can't reach. Fall back to headers.
  const origin = clientOrigin(request) ?? headerOrigin(request);
  const url = `${origin}/m/${token}`;

  const qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
  return NextResponse.json({ url, qrDataUrl, expiresInSec: UPLOAD_TOKEN_MAX_AGE });
}

// The client passes ?origin=window.location.origin. Accept only a well-formed
// http(s) origin (this only ever points the user's own phone at their own QR).
function clientOrigin(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get("origin");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

function headerOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
