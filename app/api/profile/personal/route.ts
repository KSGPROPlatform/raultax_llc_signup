import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertUser, type Profile } from "@/lib/users";
import { SESSION_COOKIE, encryptSession, sessionCookieOptions } from "@/lib/session";
import type { PersonalInfoValues } from "@/components/profile/PersonalInfoForm";
import { getUserProfile } from "@/lib/profileData";

// GET /api/profile/personal — the user's saved personal info (first/last from
// sign-up + anything from a prior visit), used to pre-fill the onboarding step.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await getUserProfile(user.sub);
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
    marital_status: p?.marital_status ?? "",
    filing_status: p?.filing_status ?? "",
    phone_number: p?.phone_number ?? "",
    ssn: p?.ssn ?? "",
    street_address: p?.street_address ?? "",
    city: p?.city ?? "",
    state_province: p?.state_province ?? "",
    postal_code: p?.postal_code ?? "",
  };
  return NextResponse.json({ profile });
}

// POST /api/profile/personal — saves the Personal info (the first onboarding
// step) into our DB, sets the user's name, and re-mints the session so the
// dashboard reflects it immediately.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const v = (await request.json().catch(() => ({}))) as Partial<PersonalInfoValues>;

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
