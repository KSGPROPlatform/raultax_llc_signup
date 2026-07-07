import "server-only";

// Server-side client for the profile-form Azure Functions (dependents /
// bankAccounts / companies) on ksgpro-api. Same base/key + X-App-Id as
// lib/files.ts. The app's route handlers call these with the VERIFIED session oid.
const base = process.env.PROFILE_API_URL;
const key = process.env.PROFILE_API_KEY;
const APP_HEADERS = { "X-App-Id": "raultax" };

export function isProfileConfigured(): boolean {
  return Boolean(base);
}

function fnUrl(
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(`${(base ?? "").replace(/\/$/, "")}/${path}`);
  if (key) url.searchParams.set("code", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// Rendered during SSR / called from route handlers — list never throws.
async function listRows<T>(route: string, oid: string): Promise<T[]> {
  if (!base) return [];
  try {
    const res = await fetch(fnUrl(route, { oid }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`${route} list returned`, res.status);
      return [];
    }
    return (await res.json()) as T[];
  } catch (err) {
    console.error(`${route} list failed:`, err);
    return [];
  }
}

async function saveRow<T>(
  route: string,
  oid: string,
  data: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(fnUrl(route), {
    method: "POST",
    headers: { ...APP_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ oid, ...data }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(msg.error ?? "Save failed");
  }
  return (await res.json()) as T;
}

async function deleteRow(route: string, oid: string, id: number): Promise<void> {
  const res = await fetch(fnUrl(route, { oid, id }), {
    method: "DELETE",
    headers: APP_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Delete failed");
}

// ---- Dependents (Form 2) ----
export type Dependent = {
  id: number;
  owner_oid: string;
  full_name: string;
  ssn: string;
  date_of_birth: string;
  relationship: string;
  created_at: string;
  updated_at: string;
};
export type DependentInput = {
  id?: number;
  full_name: string;
  ssn: string;
  date_of_birth: string;
  relationship: string;
};
export const listDependents = (oid: string) =>
  listRows<Dependent>("dependents", oid);
export const saveDependent = (oid: string, d: DependentInput) =>
  saveRow<Dependent>("dependents", oid, d);
export const deleteDependent = (oid: string, id: number) =>
  deleteRow("dependents", oid, id);

// ---- Bank accounts (Form 3) ----
export type BankAccount = {
  id: number;
  owner_oid: string;
  bank_name: string;
  account_number: string;
  routing_number: string;
  created_at: string;
  updated_at: string;
};
export type BankAccountInput = {
  id?: number;
  bank_name: string;
  account_number: string;
  routing_number: string;
};
export const listBankAccounts = (oid: string) =>
  listRows<BankAccount>("bankAccounts", oid);
export const saveBankAccount = (oid: string, b: BankAccountInput) =>
  saveRow<BankAccount>("bankAccounts", oid, b);
export const deleteBankAccount = (oid: string, id: number) =>
  deleteRow("bankAccounts", oid, id);

// ---- Companies (Form 4) ----
export type Company = {
  id: number;
  owner_oid: string;
  company_name: string;
  ein: string;
  activities: string;
  business_expense: number | null;
  created_at: string;
  updated_at: string;
};
export type CompanyInput = {
  id?: number;
  company_name: string;
  ein: string;
  activities: string;
};
export const listCompanies = (oid: string) =>
  listRows<Company>("companies", oid);
export const saveCompany = (oid: string, c: CompanyInput) =>
  saveRow<Company>("companies", oid, c);
export const deleteCompany = (oid: string, id: number) =>
  deleteRow("companies", oid, id);

// ---- Company profit/loss line items (per company) ----
export type CompanyLine = {
  id: number;
  owner_oid: string;
  company_id: number;
  kind: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
};
export type CompanyLineInput = {
  id?: number;
  companyId: number;
  kind: "income" | "expense";
  category: string;
  description: string;
  amount: number;
};
export async function listCompanyLines(
  oid: string,
  companyId: number,
): Promise<CompanyLine[]> {
  if (!base) return [];
  try {
    const res = await fetch(fnUrl("companyLines", { oid, companyId }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    return (await res.json()) as CompanyLine[];
  } catch (err) {
    console.error("companyLines list failed:", err);
    return [];
  }
}
export const saveCompanyLine = (oid: string, line: CompanyLineInput) =>
  saveRow<CompanyLine>("companyLines", oid, line);
export const deleteCompanyLine = (oid: string, id: number) =>
  deleteRow("companyLines", oid, id);

// ---- Jobs (one user has many; W-2/1099 attach per job via file job_id) ----
export type Job = {
  id: number;
  owner_oid: string;
  job_name: string;
  created_at: string;
  updated_at: string;
};
export type JobInput = { id?: number; job_name: string };
export const listJobs = (oid: string) => listRows<Job>("jobs", oid);
export const saveJob = (oid: string, j: JobInput) => saveRow<Job>("jobs", oid, j);
export const deleteJob = (oid: string, id: number) => deleteRow("jobs", oid, id);

// ---- Declarations (one per user + tax year; the year is the filing's key) ----
export type Declaration = {
  id: number;
  owner_oid: string;
  tax_year: number;
  status: string; // draft | submitted (future)
  created_at: string;
  updated_at: string;
};
export const listDeclarations = (oid: string) =>
  listRows<Declaration>("declarations", oid);
export const createDeclaration = (oid: string, taxYear: number) =>
  saveRow<Declaration>("declarations", oid, { taxYear });

// ---- Spouse (filing-status driven; one per user) ----
export type Spouse = {
  id: number;
  owner_oid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  ssn: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
};
// Partial: "Married filing separately" saves only the SSN; "Married filing
// jointly" saves the full record. Absent fields are kept by the function.
export type SpouseInput = Partial<
  Pick<
    Spouse,
    | "first_name"
    | "last_name"
    | "date_of_birth"
    | "ssn"
    | "street_address"
    | "city"
    | "state_province"
    | "postal_code"
  >
>;

export async function getSpouse(oid: string): Promise<Spouse | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("spouse", { oid }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Spouse | null;
    return data && data.id ? data : null;
  } catch (err) {
    console.error("spouse get failed:", err);
    return null;
  }
}
export const saveSpouse = (oid: string, s: SpouseInput) =>
  saveRow<Spouse>("spouse", oid, s);

// ---- The signed-in user's own saved personal profile ----
// Reads the user's raul_tax_users row via the manageUsers function (scoped to
// the caller's oid by the /api/profile/personal route) so the onboarding
// Personal-info step can pre-fill first/last (captured at sign-up) + the rest.
export type SavedProfile = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  marital_status: string | null;
  filing_status: string | null;
  phone_number: string | null;
  ssn: string | null;
  street_address: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
} | null;

export async function getUserProfile(oid: string): Promise<SavedProfile> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("manageUsers", { oid }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: SavedProfile };
    return data.user ?? null;
  } catch (err) {
    console.error("getUserProfile failed:", err);
    return null;
  }
}
