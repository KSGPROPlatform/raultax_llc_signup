import "server-only";
import { EncryptJWT, jwtDecrypt } from "jose";

// Short-lived, single-user, UPLOAD-ONLY token for the QR phone-handoff. The web
// (authenticated) mints one; the phone presents it to upload documents to that
// user's account WITHOUT logging in. It is NOT a session — the `purpose` claim
// makes sure it can never be used as one — and it expires quickly.

const PURPOSE = "mobile-upload";
export const UPLOAD_TOKEN_MAX_AGE = 20 * 60; // 20 minutes

let keyPromise: Promise<Uint8Array> | undefined;
function getKey(): Promise<Uint8Array> {
  if (!keyPromise) {
    const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    if (!secret) throw new Error("SESSION_SECRET (or AUTH_SECRET) is not set");
    keyPromise = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(secret))
      .then((buf) => new Uint8Array(buf));
  }
  return keyPromise;
}

// What a QR upload is for: a specific document slot (and job), so the phone page
// uploads to exactly the right place.
export type UploadTarget = {
  docType?: string | null;
  jobId?: number | null;
  label?: string | null;
};

export type UploadTokenPayload = {
  oid: string;
  docType: string | null;
  jobId: number | null;
  label: string | null;
};

export async function createUploadToken(
  oid: string,
  target?: UploadTarget,
): Promise<string> {
  const key = await getKey();
  return new EncryptJWT({
    oid,
    purpose: PURPOSE,
    docType: target?.docType ?? null,
    jobId: target?.jobId ?? null,
    label: target?.label ?? null,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${UPLOAD_TOKEN_MAX_AGE}s`)
    .encrypt(key);
}

export async function verifyUploadToken(
  token: string | undefined | null,
): Promise<UploadTokenPayload | null> {
  if (!token) return null;
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(token, key);
    if (payload.purpose !== PURPOSE || typeof payload.oid !== "string") return null;
    return {
      oid: payload.oid,
      docType: typeof payload.docType === "string" ? payload.docType : null,
      jobId: typeof payload.jobId === "number" ? payload.jobId : null,
      label: typeof payload.label === "string" ? payload.label : null,
    };
  } catch {
    // Expired, tampered, or signed with an old secret.
    return null;
  }
}
