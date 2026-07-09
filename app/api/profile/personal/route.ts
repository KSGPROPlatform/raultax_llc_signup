import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertUser, type Profile } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";
import type { PersonalInfoValues } from "@/components/profile/PersonalInfoForm";
import { getUserProfile, listDeclarations, createDeclaration, revertSubmissionToDraft } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";
import { cardConsistencyError } from "@/lib/identity";

// GET /api/profile/personal — the user's saved personal info for the ACTIVE
// declaration year. Identity (name, DOB, SSN, phone) comes from the profile;
// the year-changing 1040 facts (filing status, marital status, address) come
// from the active year's declaration, falling back to the profile values.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = await activeTaxYear();
  const [p, decls] = await Promise.all([
    getUserProfile(user.sub),
    listDeclarations(user.sub),
  ]);
  const d = decls.find((r) => r.tax_year === year);
  const perYear = (dv?: string | null, uv?: string | null) =>
    dv && dv.trim() ? dv : (uv ?? "");
  // Fallback: if the granular first/last name aren't stored (e.g. the account was
  // created before they were captured, or a signup upsert failed), derive them
  // from the session display name so Form 1 still pre-fills. First token = first
  // name, the rest = last name.
  const nameParts = (user.name || "").trim().split(/\s+/).filter(Boolean);
  const fbFirst = nameParts[0] ?? "";
  const fbLast = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const profile: PersonalInfoValues = {
    first_name: p?.first_name || fbFirst,
    middle_name: p?.middle_name ?? "",
    last_name: p?.last_name || fbLast,
    date_of_birth: p?.date_of_birth ?? "",
    marital_status: perYear(d?.marital_status, p?.marital_status),
    filing_status: perYear(d?.filing_status, p?.filing_status),
    phone_number: p?.phone_number ?? "",
    ssn: p?.ssn ?? "",
    street_address: perYear(d?.street_address, p?.street_address),
    city: perYear(d?.city, p?.city),
    state_province: perYear(d?.state_province, p?.state_province),
    postal_code: perYear(d?.postal_code, p?.postal_code),
  };
  return NextResponse.json({ profile, taxYear: year });
}

// POST /api/profile/personal — saves the Personal info (the first onboarding
// step) into our DB, sets the user's name, and re-mints the session so the
// dashboard reflects it immediately.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const v = (await request.json().catch(() => ({}))) as Partial<PersonalInfoValues>;

  // Save-time guard: the SSN/name being saved must match the verified SSN card
  // already on file (the card was checked against the TYPED values at upload;
  // this stops the field being changed afterwards).
  const conflict = await cardConsistencyError(user.sub, "ssn_copy", {
    name: [v.first_name, v.last_name].filter(Boolean).join(" "),
    ssn: v.ssn,
  });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });

  const profile: Profile = {
    first_name: v.first_name,
    middle_name: v.middle_name,
    last_name: v.last_name,
    date_of_birth: v.date_of_birth,
    filing_status: v.filing_status,
    marital_status: v.marital_status,
    phone_number: v.phone_number,
    ssn: v.ssn,
    street_address: v.street_address,
    city: v.city,
    state_province: v.state_province,
    postal_code: v.postal_code,
  };

  const name = [v.first_name, v.middle_name, v.last_name].filter(Boolean).join(" ");

  const { role, ownsEstablishment } = await upsertUser({ ...user, name }, profile);

  // The year-changing 1040 facts also land on the ACTIVE year's declaration —
  // this is their source of truth (the profile copy is a fallback for
  // pre-declaration accounts).
  try {
    await createDeclaration(user.sub, await activeTaxYear(), {
      filing_status: v.filing_status,
      marital_status: v.marital_status,
      street_address: v.street_address,
      city: v.city,
      state_province: v.state_province,
      postal_code: v.postal_code,
    });
  } catch (err) {
    console.error("declaration personal save failed:", err);
  }
  await revertSubmissionToDraft(user.sub, await activeTaxYear());
  // Keep the user's current onboardingComplete — completing Personal info alone
  // does not finish the journey.
  const updated = {
    ...user,
    name,
    role,
    ownsEstablishment,
    onboardingComplete: user.onboardingComplete,
  };
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await encryptSession(updated), sessionCookieOptions());
  return res;
}
