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

  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const url = `${origin}/m/${token}`;

  const qrDataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
  return NextResponse.json({ url, qrDataUrl, expiresInSec: UPLOAD_TOKEN_MAX_AGE });
}
