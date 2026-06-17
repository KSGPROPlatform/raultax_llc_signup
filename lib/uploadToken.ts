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

export async function createUploadToken(oid: string): Promise<string> {
  const key = await getKey();
  return new EncryptJWT({ oid, purpose: PURPOSE })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${UPLOAD_TOKEN_MAX_AGE}s`)
    .encrypt(key);
}

export async function verifyUploadToken(
  token: string | undefined | null,
): Promise<{ oid: string } | null> {
  if (!token) return null;
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(token, key);
    if (payload.purpose !== PURPOSE || typeof payload.oid !== "string") return null;
    return { oid: payload.oid };
  } catch {
    // Expired, tampered, or signed with an old secret.
    return null;
  }
}
