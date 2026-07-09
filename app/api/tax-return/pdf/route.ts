import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { activeTaxYear } from "@/lib/activeYear";
import { isAllowedTaxYear } from "@/lib/taxYear";
import { computeTaxReturn, getTaxReturn } from "@/lib/tax";
import {
  getUserProfile,
  listDeclarations,
  getSpouse,
  listDependents,
  listBankAccounts,
  listJobs,
} from "@/lib/profileData";
import { fill1040Pdf, hasF1040Template } from "@/lib/pdf/fill1040";

export const runtime = "nodejs";

// GET /api/tax-return/pdf?year= — the user's return written into the OFFICIAL
// IRS Form 1040 PDF (flattened; DRAFT watermark until the preparer approves).
// Same data as /dashboard/return: effective values = overrides over computed.
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const raw = request.nextUrl.searchParams.get("year") ?? undefined;
  const year = raw && isAllowedTaxYear(raw) ? Number(raw) : await activeTaxYear();
  if (!hasF1040Template(year)) {
    return NextResponse.json(
      { error: `The official ${year} form isn't available for download yet.` },
      { status: 404 },
    );
  }

  // Refresh the numbers first (a frozen return is left untouched).
  await computeTaxReturn(user.sub, year);
  const row = await getTaxReturn(user.sub, year);
  if (!row) {
    return NextResponse.json(
      { error: `No computed return for ${year} — submit your declaration first.` },
      { status: 404 },
    );
  }

  const [profile, decls, spouse, dependents, banks, jobs] = await Promise.all([
    getUserProfile(user.sub),
    listDeclarations(user.sub),
    getSpouse(user.sub, year),
    listDependents(user.sub, year),
    listBankAccounts(user.sub, year),
    listJobs(user.sub, year),
  ]);
  const decl = decls.find((d) => d.tax_year === year);
  const filingStatus = (decl?.filing_status ?? "").trim();
  const marriedFiling =
    filingStatus === "Married filing jointly" || filingStatus === "Married filing separately";

  // Effective value per line: preparer override wins over the computed value.
  const overrides = (row.overrides ?? {}) as Record<string, { value?: number }>;
  const eff = (k: string): number | null => {
    const o = Number(overrides[k]?.value);
    if (Number.isFinite(o)) return o;
    const v = Number((row as Record<string, unknown>)[k]);
    return Number.isFinite(v) ? v : null;
  };
  const values: Record<string, number | null> = {};
  for (const k of Object.keys(row)) if (k.startsWith("line_")) values[k] = eff(k);
  // Form carryovers the engine stores once: 11b repeats 11a; 35a defaults to
  // the full overpayment on line 34.
  values.line_11b ??= values.line_11a ?? null;
  if (values.line_35a === null && (values.line_34 ?? 0) > 0) values.line_35a = values.line_34;

  // Mirrors the engine: senior = born before Jan 2 of (year − 64); a
  // dependent is a CTC child if their 17th birthday falls after Dec 31.
  const bornBeforeCutoff = (dob?: string | null) => {
    const d = dob ? new Date(dob) : null;
    return d instanceof Date && !isNaN(d.getTime()) && d < new Date(year - 64, 0, 2);
  };
  const isCtcChild = (dob?: string | null) => {
    const d = dob ? new Date(dob) : null;
    if (!d || isNaN(d.getTime())) return false;
    return new Date(d.getFullYear() + 17, d.getMonth(), d.getDate()) > new Date(year, 11, 31);
  };

  const pdf = await fill1040Pdf({
    taxYear: year,
    frozen: Boolean(row.frozen),
    values,
    firstName: profile?.first_name,
    middleName: profile?.middle_name,
    lastName: profile?.last_name,
    ssn: profile?.ssn,
    street: decl?.street_address,
    city: decl?.city,
    state: decl?.state_province,
    zip: decl?.postal_code,
    filingStatus,
    seniorSelf: bornBeforeCutoff(profile?.date_of_birth),
    seniorSpouse:
      filingStatus === "Married filing jointly" && bornBeforeCutoff(spouse?.date_of_birth),
    spouse: marriedFiling && spouse
      ? { firstName: spouse.first_name, lastName: spouse.last_name, ssn: spouse.ssn }
      : null,
    dependents: dependents.map((d) => ({
      fullName: d.full_name ?? "",
      ssn: d.ssn,
      relationship: d.relationship,
      ctc: isCtcChild(d.date_of_birth) && (d.ssn ?? "").replace(/\D/g, "").length === 9,
    })),
    occupation: jobs[0]?.occupation || null,
    bank: banks[0]
      ? { routing: banks[0].routing_number, account: banks[0].account_number }
      : null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Form-1040-${year}${row.frozen ? "" : "-DRAFT"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
