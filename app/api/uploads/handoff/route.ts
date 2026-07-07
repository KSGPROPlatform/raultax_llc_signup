import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { createUploadToken, UPLOAD_TOKEN_MAX_AGE } from "@/lib/uploadToken";
import { isKnownDocType } from "@/lib/docTypes";
import { TAX_YEAR_COOKIE, resolveTaxYear } from "@/lib/taxYear";

// GET /api/uploads/handoff — (authenticated) mints a short-lived upload-only
// token and returns a QR code the user scans to continue uploading on their
// phone. The token encodes the user's oid; the phone needs no login.
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional target slot so the phone uploads to exactly the right place
  // (a specific document, optionally tied to a job).
  const params = new URL(request.url).searchParams;
  const docTypeRaw = params.get("docType");
  const docType = docTypeRaw && isKnownDocType(docTypeRaw) ? docTypeRaw : null;
  const jobIdRaw = params.get("jobId");
  const jobId = jobIdRaw && /^\d+$/.test(jobIdRaw) ? Number(jobIdRaw) : null;
  const label = (params.get("label") || "").slice(0, 80) || null;
  // Embed the active declaration year so the phone (no cookie) stamps uploads
  // with the same year the desktop session is declaring.
  const jar = await cookies();
  const taxYear = resolveTaxYear(jar.get(TAX_YEAR_COOKIE)?.value);
  const token = await createUploadToken(user.sub, { docType, jobId, label, taxYear });

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
