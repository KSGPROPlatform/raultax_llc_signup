import { EncryptJWT, jwtDecrypt } from "jose";

// Encrypted (JWE) httpOnly session cookie. Pure crypto only — no next/headers,
// no Node-only APIs — so this module is safe to import from Edge middleware as
// well as route handlers and server components.

export const SESSION_COOKIE = "rt_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

// Claims decoded from the Entra ID token (Microsoft owns the account).
export type AuthClaims = {
  sub: string;
  email: string | null;
  name: string | null;
};

export type Role = "admin" | "reviewer" | "user";

// What we keep in the session cookie: the claims plus our app-managed state
// (resolved from Azure SQL via the upsertUser function on sign-in/sign-up).
// `onboardingComplete` drives the post-sign-up /onboarding gate; it is re-minted
// when the user finishes the onboarding journey.
export type SessionUser = AuthClaims & {
  role: Role;
  onboardingComplete: boolean;
  ownsEstablishment: boolean;
};

let keyPromise: Promise<Uint8Array> | undefined;

// A256GCM needs a 32-byte key; derive it from the secret via SHA-256.
function getKey(): Promise<Uint8Array> {
  if (!keyPromise) {
    const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("SESSION_SECRET (or AUTH_SECRET) is not set");
    }
    keyPromise = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(secret))
      .then((buf) => new Uint8Array(buf));
  }
  return keyPromise;
}

export async function encryptSession(user: SessionUser): Promise<string> {
  const key = await getKey();
  return new EncryptJWT({ user })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .encrypt(key);
}

export async function decryptSession(
  token: string | undefined | null,
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const key = await getKey();
    const { payload } = await jwtDecrypt(token, key);
    return (payload.user as SessionUser) ?? null;
  } catch {
    // Tampered, expired, or signed with an old secret — treat as no session.
    return null;
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
