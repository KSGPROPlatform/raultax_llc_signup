// SERVER-SIDE input validation — the security boundary. The client forms have
// their own UX validation (lib/validation.ts), but anything can POST to the API
// directly, so every mutating route re-validates here before data leaves the
// route. SQL injection is already impossible at the data layer (all function
// queries use typed parameter binding); this layer enforces per-field FORMAT,
// CHARSET and LENGTH so garbage or hostile input never gets stored.
//
// Every entity validator returns { data } with the CLEANED values on success,
// or { error } with a user-facing message on the first failure.

import { validateName, validateSsn, validateZip, dobYearRange } from "./validation";
import { US_STATES } from "./usStates";

// ---------- primitives ----------

// Strip control characters (incl. NUL, ESC) and collapse runs of whitespace.
const CONTROL = /[\u0000-\u001F\u007F]/g;
export function cleanText(v: unknown): string {
  return String(v ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

// Free-text fields (company names, activities, descriptions…): printable text
// without markup/backtick/backslash characters — blocks stored-XSS payloads
// and shell/SQL-looking junk while keeping normal punctuation usable.
const TEXT_FORBIDDEN = /[<>`\\{}|]/;

function vText(
  label: string,
  raw: unknown,
  opts: { required?: boolean; max: number },
): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return opts.required ? { error: `${label} is required.` } : { value: "" };
  if (v.length > opts.max) return { error: `${label} is too long (max ${opts.max} characters).` };
  if (TEXT_FORBIDDEN.test(v)) return { error: `${label} contains characters that aren't allowed.` };
  return { value: v };
}

function vName(
  label: string,
  raw: unknown,
  opts: { required?: boolean } = { required: true },
): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return opts.required ? { error: `${label} is required.` } : { value: "" };
  const err = validateName(v, label); // letters/spaces/hyphens/apostrophes, 2–128
  return err ? { error: err } : { value: v };
}

function vChoice(
  label: string,
  raw: unknown,
  allowed: readonly string[],
  required = true,
): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return required ? { error: `${label} is required.` } : { value: "" };
  const hit = allowed.find((a) => a.toLowerCase() === v.toLowerCase());
  return hit ? { value: hit } : { error: `${label} must be one of: ${allowed.join(", ")}.` };
}

// Dates arrive as MM/DD/YYYY (the forms) or YYYY-MM-DD (older rows) — accept
// both, require a REAL calendar date, and keep the year inside [minYear, maxYear].
function vDate(
  label: string,
  raw: unknown,
  opts: { required?: boolean; minYear: number; maxYear: number },
): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return opts.required ? { error: `${label} is required.` } : { value: "" };
  let mm: number, dd: number, yyyy: number;
  let m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    mm = Number(m[1]); dd = Number(m[2]); yyyy = Number(m[3]);
  } else if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    yyyy = Number(m[1]); mm = Number(m[2]); dd = Number(m[3]);
  } else {
    return { error: `${label}: enter the date as MM/DD/YYYY.` };
  }
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return { error: `${label}: that date doesn't exist.` };
  }
  if (yyyy < opts.minYear || yyyy > opts.maxYear) {
    return { error: `${label}: year must be between ${opts.minYear} and ${opts.maxYear}.` };
  }
  return { value: v };
}

function vSsnField(raw: unknown, required = true): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return required ? { error: "SSN is required." } : { value: "" };
  const err = validateSsn(v); // 9 digits + SSA structural rules
  return err ? { error: err } : { value: v };
}

function vStateField(raw: unknown, required = true): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return required ? { error: "State is required." } : { value: "" };
  const hit = US_STATES.find(
    (s) => s.name.toLowerCase() === v.toLowerCase() || s.code.toLowerCase() === v.toLowerCase(),
  );
  return hit ? { value: hit.name } : { error: "Select a valid US state." };
}

function vZipField(raw: unknown, required = true): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return required ? { error: "Postal code is required." } : { value: "" };
  const err = validateZip(v);
  return err ? { error: err } : { value: v };
}

function vPhone(raw: unknown, required = true): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return required ? { error: "Phone number is required." } : { value: "" };
  if (!/^[\d()+\-. ]+$/.test(v)) return { error: "Phone number contains invalid characters." };
  const digits = v.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    return { error: "Enter a valid phone number (10–15 digits)." };
  }
  return { value: v };
}

// EIN: XX-XXXXXXX — 9 digits, valid IRS campus/prefix can't be 00.
function vEin(raw: unknown): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return { error: "EIN is required." };
  const digits = v.replace(/\D/g, "");
  if (!/^\d{2}-?\d{7}$/.test(v) || digits.length !== 9) {
    return { error: "Enter a valid EIN (format 12-3456789)." };
  }
  if (digits.slice(0, 2) === "00" || digits === "000000000") {
    return { error: "That isn't a valid EIN." };
  }
  return { value: `${digits.slice(0, 2)}-${digits.slice(2)}` };
}

// ABA routing number: exactly 9 digits + the ABA checksum
// (3·(d1+d4+d7) + 7·(d2+d5+d8) + (d3+d6+d9)) mod 10 === 0.
function vRouting(raw: unknown): { value?: string; error?: string } {
  const v = cleanText(raw).replace(/[\s-]/g, "");
  if (!v) return { error: "Routing number is required." };
  if (!/^\d{9}$/.test(v)) return { error: "Routing number must be exactly 9 digits." };
  const d = v.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  if (sum % 10 !== 0) return { error: "That isn't a valid US routing number." };
  return { value: v };
}

function vAccountNumber(raw: unknown): { value?: string; error?: string } {
  const v = cleanText(raw).replace(/[\s-]/g, "");
  if (!v) return { error: "Account number is required." };
  if (!/^\d{4,17}$/.test(v)) return { error: "Account number must be 4–17 digits." };
  return { value: v };
}

// Optional dollar amount: absent/empty -> null; else finite, 0..99,999,999.99.
function vOptionalAmount(
  label: string,
  raw: unknown,
): { value?: number | null; error?: string } {
  if (raw === undefined || raw === null || raw === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  const abs = Math.abs(n);
  if (abs > 99_999_999.99) return { error: `${label} is out of range.` };
  return { value: Math.round(abs * 100) / 100 };
}

// SSN or EIN (Form 2441 provider tax id): 9 digits, either format.
function vTaxId(raw: unknown): { value?: string; error?: string } {
  const v = cleanText(raw);
  if (!v) return { value: "" };
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 9 || !/^[\d\- ]+$/.test(v)) {
    return { error: "Provider tax ID must be a 9-digit SSN or EIN." };
  }
  return { value: v };
}

// ---------- option lists (mirror the form dropdowns) ----------

export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed", "Separated"] as const;
export const FILING_STATUSES = [
  "Single",
  "Married filing jointly",
  "Married filing separately",
  "Head of household",
] as const;

// ---------- entity validators (used by the API routes) ----------

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };
const currentYear = () => new Date().getFullYear();

export function validatePersonalInput(body: Record<string, unknown>): Result<{
  first_name: string; middle_name: string; last_name: string;
  date_of_birth: string; marital_status: string; filing_status: string;
  phone_number: string; ssn: string;
  street_address: string; city: string; state_province: string; postal_code: string;
}> {
  const { min, max } = dobYearRange(currentYear());
  const first = vName("First name", body.first_name);
  const middle = vName("Middle name", body.middle_name, { required: false });
  const last = vName("Last name", body.last_name);
  const dob = vDate("Date of birth", body.date_of_birth, { required: true, minYear: min, maxYear: max });
  const marital = vChoice("Marital status", body.marital_status, MARITAL_STATUSES);
  const filing = vChoice("Filing status", body.filing_status, FILING_STATUSES);
  const phone = vPhone(body.phone_number);
  const ssn = vSsnField(body.ssn);
  const street = vText("Street address", body.street_address, { required: true, max: 200 });
  const city = vName("City", body.city);
  const state = vStateField(body.state_province);
  const zip = vZipField(body.postal_code);
  for (const r of [first, middle, last, dob, marital, filing, phone, ssn, street, city, state, zip]) {
    if (r.error) return { error: r.error };
  }
  return {
    data: {
      first_name: first.value!, middle_name: middle.value!, last_name: last.value!,
      date_of_birth: dob.value!, marital_status: marital.value!, filing_status: filing.value!,
      phone_number: phone.value!, ssn: ssn.value!,
      street_address: street.value!, city: city.value!,
      state_province: state.value!, postal_code: zip.value!,
    },
  };
}

// Spouse saves are PARTIAL (MFS sends name + SSN only), so validate only the
// fields present in the body; each present field must be valid.
export function validateSpouseInput(
  body: Record<string, unknown>,
): Result<Record<string, string | number>> {
  const { min, max } = dobYearRange(currentYear());
  const out: Record<string, string | number> = {};
  const checks: [string, { value?: string; error?: string }][] = [];
  if (typeof body.first_name === "string") checks.push(["first_name", vName("Spouse first name", body.first_name)]);
  if (typeof body.last_name === "string") checks.push(["last_name", vName("Spouse last name", body.last_name)]);
  if (typeof body.date_of_birth === "string" && cleanText(body.date_of_birth))
    checks.push(["date_of_birth", vDate("Spouse date of birth", body.date_of_birth, { required: true, minYear: min, maxYear: max })]);
  if (typeof body.ssn === "string") checks.push(["ssn", vSsnField(body.ssn)]);
  if (typeof body.street_address === "string" && cleanText(body.street_address))
    checks.push(["street_address", vText("Street address", body.street_address, { max: 200 })]);
  if (typeof body.city === "string" && cleanText(body.city)) checks.push(["city", vName("City", body.city)]);
  if (typeof body.state_province === "string" && cleanText(body.state_province))
    checks.push(["state_province", vStateField(body.state_province)]);
  if (typeof body.postal_code === "string" && cleanText(body.postal_code))
    checks.push(["postal_code", vZipField(body.postal_code)]);
  for (const [key, r] of checks) {
    if (r.error) return { error: r.error };
    out[key] = r.value!;
  }
  if (body.earned_income !== undefined) {
    const ei = vOptionalAmount("Spouse earned income", body.earned_income);
    if (ei.error) return { error: ei.error };
    if (ei.value !== null && ei.value !== undefined) out.earned_income = ei.value;
  }
  return { data: out };
}

export function validateDependentInput(body: Record<string, unknown>): Result<{
  full_name: string; ssn: string; date_of_birth: string; relationship: string;
  care_expenses: number | null; is_disabled: boolean;
}> {
  const name = vName("Dependent name", body.full_name);
  const ssn = vSsnField(body.ssn);
  // Dependents can be newborns — allow current year back to 120 years.
  const dob = vDate("Date of birth", body.date_of_birth, {
    required: true, minYear: currentYear() - 120, maxYear: currentYear(),
  });
  const rel = vText("Relationship", body.relationship, { required: true, max: 40 });
  const care = vOptionalAmount("Childcare expenses", body.care_expenses);
  for (const r of [name, ssn, dob, rel]) if (r.error) return { error: r.error };
  if (care.error) return { error: care.error };
  return {
    data: {
      full_name: name.value!, ssn: ssn.value!, date_of_birth: dob.value!,
      relationship: rel.value!, care_expenses: care.value ?? null,
      is_disabled: Boolean(body.is_disabled),
    },
  };
}

// Form 2441 Part I care provider.
export function validateCareProviderInput(body: Record<string, unknown>): Result<{
  provider_name: string; address: string; tax_id: string;
  is_household_employee: boolean; amount_paid: number | null;
}> {
  const name = vText("Care provider name", body.provider_name, { required: true, max: 256 });
  const address = vText("Provider address", body.address, { required: false, max: 512 });
  const taxId = vTaxId(body.tax_id);
  const amount = vOptionalAmount("Amount paid", body.amount_paid);
  for (const r of [name, address, taxId]) if (r.error) return { error: r.error };
  if (amount.error) return { error: amount.error };
  return {
    data: {
      provider_name: name.value!, address: address.value!, tax_id: taxId.value!,
      is_household_employee: Boolean(body.is_household_employee),
      amount_paid: amount.value ?? null,
    },
  };
}

export function validateBankAccountInput(body: Record<string, unknown>): Result<{
  bank_name: string; account_number: string; routing_number: string;
}> {
  const bank = vText("Bank name", body.bank_name, { required: true, max: 120 });
  const routing = vRouting(body.routing_number);
  const account = vAccountNumber(body.account_number);
  for (const r of [bank, routing, account]) if (r.error) return { error: r.error };
  return { data: { bank_name: bank.value!, account_number: account.value!, routing_number: routing.value! } };
}

export function validateCompanyInput(body: Record<string, unknown>): Result<{
  company_name: string; ein: string; activities: string;
}> {
  const name = vText("Company name", body.company_name, { required: true, max: 256 });
  const ein = vEin(body.ein);
  const activities = vText("Activities", body.activities, { required: false, max: 2000 });
  for (const r of [name, ein, activities]) if (r.error) return { error: r.error };
  return { data: { company_name: name.value!, ein: ein.value!, activities: activities.value! } };
}

export function validateCompanyLineInput(body: Record<string, unknown>): Result<{
  kind: "income" | "expense"; category: string; description: string; amount: number;
}> {
  const kind = body.kind === "income" ? "income" : "expense";
  // The P&L form has ONE text field (sent as `description`); `category` is a
  // parked column — both are optional here, charset/length-checked when present.
  const category = vText("Category", body.category, { required: false, max: 80 });
  const description = vText("Description", body.description, { required: false, max: 300 });
  for (const r of [category, description]) if (r.error) return { error: r.error };
  const raw = body.amount;
  const amount = raw === "" || raw === null || raw === undefined ? 0 : Number(raw);
  if (!Number.isFinite(amount)) return { error: "Amount must be a number." };
  const abs = Math.abs(amount);
  if (abs > 99_999_999.99) return { error: "Amount is out of range." };
  return { data: { kind, category: category.value!, description: description.value!, amount: Math.round(abs * 100) / 100 } };
}

export function validateJobInput(body: Record<string, unknown>): Result<{
  job_name: string; occupation: string; company_name: string;
}> {
  const occupation = vText("Occupation", body.occupation, { required: true, max: 80 });
  const company = vText("Company name", body.company_name, { required: true, max: 256 });
  const jobName = vText("Job", body.job_name, { required: false, max: 340 });
  for (const r of [occupation, company, jobName]) if (r.error) return { error: r.error };
  return {
    data: {
      job_name: jobName.value! || `${occupation.value} — ${company.value}`,
      occupation: occupation.value!,
      company_name: company.value!,
    },
  };
}

// Uploaded file names end up in DB rows and back in Content-Disposition
// headers — keep them to a sane printable length with no control characters.
export function cleanFilename(raw: unknown): string {
  const v = cleanText(raw).replace(/[\\/:*?"<>|]/g, "_");
  return (v || "upload").slice(0, 180);
}

// Row ids on create/update bodies: absent is fine, present must be a positive int.
export function optionalId(raw: unknown): { id?: number; error?: string } {
  if (raw === undefined || raw === null || raw === "") return {};
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? { id: n } : { error: "Invalid id." };
}
