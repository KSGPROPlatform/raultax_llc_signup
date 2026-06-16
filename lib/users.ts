import "server-only";
import type { AuthClaims, Role } from "./session";

// Rich profile collected by our own sign-up form (stored in raul_tax_users, NOT
// in Entra). All optional — only sent on sign-up.
export type Profile = {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  date_of_birth?: string;
  filing_status?: string;
  marital_status?: string;
  job_title?: string;
  phone_number?: string;
  ssn?: string;
  street_address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
};

// Mirrors the signed-in user into Azure SQL by calling our standalone
// `upsertUser` Azure Function server-to-server, and returns the resolved role.
//
// Resilient by design: if the function/DB is unconfigured or unreachable, we log
// and fall back to role "user" so authentication NEVER breaks because of the
// profile store.
export async function upsertUser(
  claims: AuthClaims,
  profile?: Profile,
): Promise<{ role: Role }> {
  // NB: not FUNCTIONS_* — Azure Static Web Apps reserves that prefix.
  const base = process.env.PROFILE_API_URL;
  const key = process.env.PROFILE_API_KEY;

  if (!base || !claims.sub) return { role: "user" };

  try {
    // Our deployed Azure Function that MERGE-upserts the user and returns role.
    const url =
      `${base.replace(/\/$/, "")}/upsertUser` +
      (key ? `?code=${encodeURIComponent(key)}` : "");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oid: claims.sub,
        email: claims.email,
        name: claims.name,
        ...(profile ?? {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("upsertUser function returned", res.status);
      return { role: "user" };
    }

    const data = (await res.json().catch(() => null)) as { role?: string } | null;
    return { role: data?.role === "admin" ? "admin" : "user" };
  } catch (err) {
    console.error("upsertUser failed:", err);
    return { role: "user" };
  }
}
