import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, decryptSession, type SessionUser } from "./session";

// Server-side helper for reading the current session in server components and
// route handlers. (Edge middleware reads the cookie off the request directly,
// so it imports lib/session, not this file.)
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}
