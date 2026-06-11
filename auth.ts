import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { upsertUserAndGetRole } from "@/lib/users";

/**
 * Auth.js (NextAuth v5) wired to Microsoft Entra External ID.
 *
 * Microsoft owns the entire sign-up / sign-in experience, email verification,
 * password, MFA, and session. We do NOT build a login form — `signIn()`
 * redirects the user to Microsoft's hosted page and they come back signed in.
 *
 * For an EXTERNAL ID (CIAM) tenant the issuer must point at ciamlogin.com,
 * not the default login.microsoftonline.com. Set it via env (see .env.example):
 *   https://<your-subdomain>.ciamlogin.com/<tenant-id>/v2.0
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          // Only what we need for identity — keeps the consent screen minimal
          // (drops the Graph "User.Read" / offline-access asks).
          scope: "openid profile email",
          // Always show Microsoft's sign-in/sign-up form instead of silently
          // reusing an existing SSO session, so a new user can actually sign up.
          prompt: "login",
        },
      },
    }),
  ],
  callbacks: {
    // On first sign-in `profile` carries every claim from Microsoft's ID token
    // (oid, email, name, tid, ...). We (1) stash the claims on the JWT and
    // (2) store/refresh the profile in Azure SQL and capture the user's role.
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as Record<string, unknown>;
        token.profile = p;
        token.role = await upsertUserAndGetRole({
          oid: p.oid as string | undefined,
          email: (p.email as string) ?? (p.preferred_username as string) ?? null,
          name: (p.name as string) ?? null,
          tid: (p.tid as string) ?? null,
        });
      }
      return token;
    },
    // Surface the claims + role to server components via `session`.
    async session({ session, token }) {
      if (token.profile) {
        session.profile = token.profile;
      }
      if (token.role) {
        session.role = token.role;
      }
      return session;
    },
  },
});
