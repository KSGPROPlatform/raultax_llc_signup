import "server-only";
import type { Role } from "./session";

// Server-side client for the admin-only `adminUsers` Azure Function. Callers
// (the /api/admin/* routes) MUST verify the session role is "admin" first.
const base = process.env.PROFILE_API_URL;
const key = process.env.PROFILE_API_KEY;
const APP_HEADERS = { "X-App-Id": "raultax" };

function fnUrl(path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(`${(base ?? "").replace(/\/$/, "")}/${path}`);
  if (key) url.searchParams.set("code", key);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

export type AdminUserRow = {
  entra_object_id: string;
  name: string | null;
  email: string | null;
  role: Role;
  created_at: string | null;
  onboarding_completed: boolean;
  owns_establishment: boolean;
  dependents: number;
  companies: number;
  bank_accounts: number;
  documents: number;
};

export type AdminUserDetail = {
  user: {
    entra_object_id: string;
    name: string | null;
    email: string | null;
    role: Role;
    created_at: string | null;
    onboarding_completed: boolean;
    owns_establishment: boolean;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    filing_status: string | null;
    marital_status: string | null;
    phone_number: string | null;
    ssn: string | null;
    street_address: string | null;
    city: string | null;
    state_province: string | null;
    postal_code: string | null;
  };
  dependents: { id: number; full_name: string; ssn: string; date_of_birth: string; relationship: string }[];
  bankAccounts: { id: number; bank_name: string; account_number: string; routing_number: string }[];
  companies: { id: number; company_name: string; ein: string; activities: string; business_expense: number | null }[];
  files: { id: number; original_name: string; content_type: string | null; size_bytes: number | null; doc_type: string | null; uploaded_at: string }[];
};

export function isAdminApiConfigured(): boolean {
  return Boolean(base);
}

export async function getAdminOverview(): Promise<AdminUserRow[]> {
  if (!base) return [];
  try {
    const res = await fetch(fnUrl("manageUsers"), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("manageUsers overview returned", res.status);
      return [];
    }
    const data = (await res.json()) as { users?: AdminUserRow[] };
    return (data.users ?? []).map((u) => ({
      ...u,
      onboarding_completed: Boolean(u.onboarding_completed),
      owns_establishment: Boolean(u.owns_establishment),
    }));
  } catch (err) {
    console.error("adminUsers overview failed:", err);
    return [];
  }
}

export async function getAdminUserDetail(oid: string): Promise<AdminUserDetail | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("manageUsers", { oid }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminUserDetail;
  } catch (err) {
    console.error("adminUsers detail failed:", err);
    return null;
  }
}
