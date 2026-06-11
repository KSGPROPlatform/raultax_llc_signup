// Make the full set of Microsoft ID-token claims available on the session
// (and on the underlying JWT) in a type-safe way.
//
// NOTE: this file lives under types/ on purpose. At the project root a file
// named next-auth.d.ts shadows the real "next-auth" package under
// baseUrl resolution and breaks every import of it.
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Every claim Microsoft returned in the ID token (oid, email, name, ...). */
    profile?: Record<string, unknown>;
    /** The user's role, resolved from the database on sign-in. */
    role?: "admin" | "user";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    profile?: Record<string, unknown>;
    role?: "admin" | "user";
  }
}

export {};
