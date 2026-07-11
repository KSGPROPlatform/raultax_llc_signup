import {
  Building2,
  UploadCloud,
  Plus,
  Mail,
  Hash,
  ArrowRight,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { JobsSection } from "@/components/dashboard/JobsSection";
import { DocUpload } from "@/components/documents/DocUpload";
import { DeclarationsCard } from "@/components/dashboard/DeclarationsCard";
import { SpouseSection } from "@/components/dashboard/SpouseSection";
import { DependentsSection } from "@/components/dashboard/DependentsSection";
import { CareProvidersSection } from "@/components/dashboard/CareProvidersSection";
import { BankSection } from "@/components/dashboard/BankSection";
import { CompaniesSection } from "@/components/dashboard/CompaniesSection";
import { getUserProfile, listDeclarations } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

const QUICK_ACTIONS = [
  { label: "Start a new filing", desc: "Form a new LLC", icon: Plus },
  { label: "Upload a document", desc: "Add to your vault", icon: UploadCloud },
  { label: "View all filings", desc: "Track your companies", icon: Building2 },
];

const cardClass =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

export default async function UserDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const name = user.name || user.email || "there";
  const first = name.split(" ")[0];

  // Filing status drives which sections appear (mirrors the onboarding journey):
  //  Single                    -> no spouse, no dependents
  //  Married filing jointly    -> full spouse + dependents
  //  Married filing separately -> spouse SSN only + dependents
  //  Head of household         -> dependents (no spouse)
  // It is PER YEAR: the active declaration's value wins; the profile copy is a
  // fallback for pre-declaration accounts.
  const year = await activeTaxYear();
  const [profile, decls] = await Promise.all([
    getUserProfile(user.sub),
    listDeclarations(user.sub),
  ]);
  const active = decls.find((d) => d.tax_year === year);
  const filingStatus =
    (active?.filing_status ?? "").trim() || (profile?.filing_status ?? "");
  const showSpouse =
    filingStatus === "Married filing jointly" ||
    filingStatus === "Married filing separately";
  const spouseMode: "full" | "ssn" =
    filingStatus === "Married filing jointly" ? "full" : "ssn";
  const showDependents = filingStatus !== "Single";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {first}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your companies, filings, and documents in one place.
        </p>
      </header>

      <DeclarationsCard />

      {/* Profile */}
      <section className={`${cardClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-amber-500/15 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {user.name || "Account"}
              </h2>
              <RoleBadge role={user.role ?? "user"} />
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={user.email ?? "—"} />
              <InfoRow icon={Hash} label="Account ID" value={user.sub} mono />
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`${cardClass} group flex items-center gap-3 p-4 text-left transition-colors hover:border-amber-400 dark:hover:border-amber-500/50`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {a.label}
              </span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {a.desc}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-amber-500 dark:text-zinc-600" />
          </button>
        ))}
      </section>

      {/* Spouse — only for Married filing jointly / separately */}
      {showSpouse && (
        <section id="spouse" className="scroll-mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Spouse information
          </h2>
          <SpouseSection mode={spouseMode} />
        </section>
      )}

      {/* Dependents — hidden for Single filers */}
      {showDependents && (
        <section id="dependents" className="scroll-mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Dependents
          </h2>
          <DependentsSection />
          <CareProvidersSection />
        </section>
      )}

      {/* Bank information */}
      <section id="bank" className="scroll-mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Bank information
        </h2>
        <BankSection />
      </section>

      {/* Companies — the "owns an establishment?" answer is per-year now */}
      <section id="companies" className="scroll-mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          My companies
        </h2>
        <CompaniesSection initialOwns={active?.owns_establishment ?? undefined} />
      </section>

      {/* Jobs */}
      <section id="jobs" className="scroll-mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Jobs
        </h2>
        <JobsSection />
      </section>

      {/* SSN document */}
      <section id="ssn-document" className="scroll-mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          SSN document
        </h2>
        <DocUpload docType="ssn_copy" label="SSN document" />
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="text-zinc-500 dark:text-zinc-400">{label}:</span>
      <span
        className={`truncate text-zinc-900 dark:text-zinc-50 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
