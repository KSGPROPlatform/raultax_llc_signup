import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isAllowedTaxYear } from "@/lib/taxYear";
import { getTaxReturn } from "@/lib/tax";
import {
  getUserProfile,
  listDeclarations,
  getSpouse,
  listDependents,
  listCareProviders,
  listBankAccounts,
  listJobs,
  listCompanies,
} from "@/lib/profileData";
import { listFiles } from "@/lib/files";
import { isYearScoped } from "@/lib/docTypes";
import { DeclarationReview } from "@/components/dashboard/DeclarationReview";

// Full per-year declaration review. Opened from a row on the dashboard's
// "My tax declarations" card. Loads EVERY input for the year in one place and
// hands it to the client review component (read-only by default; an explicit
// Edit action unlocks the section editors).
export default async function DeclarationReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const startEditing = (await searchParams).edit === "1";
  const raw = (await params).year;
  if (!isAllowedTaxYear(raw)) redirect("/dashboard/user");
  const year = Number(raw);

  const [profile, decls, spouse, dependents, careProviders, banks, jobs, companies, files, ret] =
    await Promise.all([
      getUserProfile(user.sub),
      listDeclarations(user.sub),
      getSpouse(user.sub, year),
      listDependents(user.sub, year),
      listCareProviders(user.sub, year),
      listBankAccounts(user.sub, year),
      listJobs(user.sub, year),
      listCompanies(user.sub, year),
      listFiles(user.sub),
      getTaxReturn(user.sub, year),
    ]);

  const decl = decls.find((d) => d.tax_year === year) ?? null;

  // No declaration started for this year — send them back with a gentle bounce.
  if (!decl) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          No {year} declaration yet
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You haven&apos;t started a declaration for {year}. Start one from your dashboard.
        </p>
        <Link
          href="/dashboard/user"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  // Year-scoped docs (W-2/1099) only for this year; identity docs (SSN/ID) always.
  const yearFiles = files.filter(
    (f) => !isYearScoped(f.doc_type) || (f.tax_year ?? null) === year,
  );

  const frozen = Boolean(ret?.frozen);
  const overrides = (ret?.overrides ?? {}) as Record<string, { value?: number }>;
  const eff = (k: string): number | null => {
    const o = Number(overrides[k]?.value);
    if (Number.isFinite(o)) return o;
    const v = Number((ret as Record<string, unknown> | null)?.[k]);
    return Number.isFinite(v) ? v : null;
  };
  const outcome = ret
    ? { frozen, refund: eff("line_34"), owed: eff("line_37") }
    : null;

  return (
    <DeclarationReview
      year={year}
      initialEditing={startEditing}
      status={decl.status}
      filingStatus={(decl.filing_status ?? "").trim()}
      profile={{
        firstName: profile?.first_name ?? "",
        middleName: profile?.middle_name ?? "",
        lastName: profile?.last_name ?? "",
        dateOfBirth: profile?.date_of_birth ?? "",
        ssn: profile?.ssn ?? "",
        maritalStatus: (decl.marital_status ?? profile?.marital_status ?? "").trim(),
        phone: profile?.phone_number ?? "",
        street: decl.street_address ?? "",
        city: decl.city ?? "",
        state: decl.state_province ?? "",
        zip: decl.postal_code ?? "",
      }}
      ownsEstablishment={decl.owns_establishment ?? null}
      spouse={
        spouse
          ? {
              firstName: spouse.first_name ?? "",
              lastName: spouse.last_name ?? "",
              dateOfBirth: spouse.date_of_birth ?? "",
              ssn: spouse.ssn ?? "",
              earnedIncome: spouse.earned_income ?? null,
            }
          : null
      }
      dependents={dependents.map((d) => ({
        id: d.id,
        fullName: d.full_name ?? "",
        ssn: d.ssn ?? "",
        dateOfBirth: d.date_of_birth ?? "",
        relationship: d.relationship ?? "",
        careExpenses: d.care_expenses ?? null,
        isDisabled: Boolean(d.is_disabled),
      }))}
      careProviders={careProviders.map((p) => ({
        id: p.id,
        name: p.provider_name ?? "",
        address: p.address ?? "",
        taxId: p.tax_id ?? "",
        amountPaid: p.amount_paid ?? null,
        householdEmployee: Boolean(p.is_household_employee),
      }))}
      banks={banks.map((b) => ({
        id: b.id,
        bankName: b.bank_name ?? "",
        accountNumber: b.account_number ?? "",
        routingNumber: b.routing_number ?? "",
      }))}
      jobs={jobs.map((j) => ({
        id: j.id,
        occupation: j.occupation ?? "",
        companyName: j.company_name ?? "",
      }))}
      companies={companies.map((c) => ({
        id: c.id,
        companyName: c.company_name ?? "",
        ein: c.ein ?? "",
        activities: c.activities ?? "",
        net: c.business_expense ?? null,
      }))}
      documents={yearFiles.map((f) => ({
        id: f.id,
        name: f.original_name,
        docType: f.doc_type,
        jobId: f.job_id,
      }))}
      outcome={outcome}
    />
  );
}
