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
  phone_number?: string;
  ssn?: string;
  street_address?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
};

// Onboarding-journey flags persisted on the user row (not part of the rich
// Profile). Sent à la carte by the dashboard establishment toggle and the
// "finish onboarding" route.
export type UserFlags = {
  owns_establishment?: boolean;
  onboarding_completed?: boolean;
};

export type UpsertResult = {
  role: Role;
  onboardingComplete: boolean;
  ownsEstablishment: boolean;
};

// Mirrors the signed-in user into Azure SQL by calling our standalone
// `upsertUser` Azure Function server-to-server, and returns the resolved role +
// onboarding state.
//
// Resilient by design: if the function/DB is unconfigured or unreachable, we log
// and fall back so authentication NEVER breaks because of the profile store.
// On failure we report `onboardingComplete: true` so a backend blip can't trap a
// user behind the onboarding gate (the dashboard checklist still nudges them).
export async function upsertUser(
  claims: AuthClaims,
  profile?: Profile,
  flags?: UserFlags,
): Promise<UpsertResult> {
  const FALLBACK: UpsertResult = {
    role: "user",
    onboardingComplete: true,
    ownsEstablishment: false,
  };

  // NB: not FUNCTIONS_* — Azure Static Web Apps reserves that prefix.
  const base = process.env.PROFILE_API_URL;
  const key = process.env.PROFILE_API_KEY;

  if (!base || !claims.sub) return FALLBACK;

  try {
    // Our deployed Azure Function that MERGE-upserts the user and returns state.
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
        ...(flags ?? {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("upsertUser function returned", res.status);
      return FALLBACK;
    }

    const data = (await res.json().catch(() => null)) as {
      role?: string;
      onboarding_completed?: boolean | number;
      owns_establishment?: boolean | number;
    } | null;
    return {
      role: data?.role === "admin" ? "admin" : "user",
      onboardingComplete: Boolean(data?.onboarding_completed),
      ownsEstablishment: Boolean(data?.owns_establishment),
    };
  } catch (err) {
    console.error("upsertUser failed:", err);
    return FALLBACK;
  }
}
