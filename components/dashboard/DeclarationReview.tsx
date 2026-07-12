"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Check,
  Lock,
  UserRound,
  Users,
  Baby,
  Landmark,
  Briefcase,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  Loader2,
  FileDown,
  Eye,
} from "lucide-react";
import { maskTail } from "@/components/profile/mask";
import { useToast } from "@/components/ui/Toast";
import { PersonalInfoForm, type PersonalInfoValues } from "@/components/profile/PersonalInfoForm";
import { SpouseSection } from "@/components/dashboard/SpouseSection";
import { DependentsSection } from "@/components/dashboard/DependentsSection";
import { BankSection } from "@/components/dashboard/BankSection";
import { JobsSection } from "@/components/dashboard/JobsSection";
import { CompaniesSection } from "@/components/dashboard/CompaniesSection";
import { DocUpload } from "@/components/documents/DocUpload";

type Money = number | null;

export type DeclarationReviewProps = {
  year: number;
  initialEditing?: boolean;
  status: string;
  filingStatus: string;
  profile: {
    firstName: string; middleName: string; lastName: string; dateOfBirth: string;
    ssn: string; maritalStatus: string; phone: string;
    street: string; city: string; state: string; zip: string;
  };
  ownsEstablishment: boolean | null;
  spouse: { firstName: string; lastName: string; dateOfBirth: string; ssn: string; earnedIncome: Money } | null;
  dependents: { id: number; fullName: string; ssn: string; dateOfBirth: string; relationship: string; careExpenses: Money; isDisabled: boolean }[];
  banks: { id: number; bankName: string; accountNumber: string; routingNumber: string }[];
  jobs: { id: number; occupation: string; companyName: string }[];
  companies: { id: number; companyName: string; ein: string; activities: string; net: Money }[];
  documents: { id: number; name: string; docType: string | null; jobId: number | null }[];
  outcome: { frozen: boolean; refund: Money; owed: Money } | null;
};

const money = (v: Money) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function DeclarationReview(props: DeclarationReviewProps) {
  const { year, status, filingStatus, profile, spouse, dependents, banks, jobs, companies, documents, outcome } = props;
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(Boolean(props.initialEditing));
  const [savingPersonal, setSavingPersonal] = useState(false);

  const showSpouse = filingStatus === "Married filing jointly" || filingStatus === "Married filing separately";
  const spouseMode: "full" | "ssn" = filingStatus === "Married filing jointly" ? "full" : "ssn";
  const showDependents = filingStatus !== "Single" && filingStatus !== "";
  const frozen = Boolean(outcome?.frozen);
  const approved = frozen;
  const submitted = status === "submitted";

  // Editing targets the ACTIVE declaration year — align the cookie to this year
  // so the reused section editors and document slots operate on the right data.
  async function activateYear(): Promise<boolean> {
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: year }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  useEffect(() => {
    activateYear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function toggleEdit() {
    if (editing) {
      setEditing(false);
      // Pull fresh server data back into the read-only view.
      router.refresh();
      toast.info("Review updated with your latest changes.");
      return;
    }
    const ok = await activateYear();
    if (!ok) {
      toast.error("Couldn't open editing for this year. Please try again.");
      return;
    }
    setEditing(true);
  }

  async function savePersonal(values: PersonalInfoValues) {
    setSavingPersonal(true);
    try {
      const res = await fetch("/api/profile/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Could not save your personal information.");
        return;
      }
      toast.success("Personal information saved.");
    } catch {
      toast.error("Network error — your personal information wasn't saved.");
    } finally {
      setSavingPersonal(false);
    }
  }

  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(" ") || "—";
  const address = [profile.street, [profile.city, profile.state].filter(Boolean).join(", "), profile.zip].filter(Boolean).join(" · ") || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/user"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Tax declaration
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Tax year {year}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} approved={approved} submitted={submitted} />
              {filingStatus && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{filingStatus}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {approved && (
              <a
                href={`/api/tax-return/pdf?year=${year}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <FileDown className="h-4 w-4" /> Form 1040
              </a>
            )}
            <button
              type="button"
              onClick={toggleEdit}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                editing
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-500 text-zinc-950 hover:bg-amber-400"
              }`}
            >
              {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {editing ? "Done editing" : "Edit"}
            </button>
          </div>
        </div>
      </div>

      {/* Mode banner */}
      {editing ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You&apos;re editing your {year} declaration. Changes save as you go — click{" "}
            <span className="font-semibold">Done editing</span> when you&apos;re finished.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This is a read-only review of everything you entered for {year}. Click{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Edit</span> to make changes.
          </p>
        </div>
      )}

      {/* Personal information */}
      <SectionCard icon={UserRound} title="Personal information">
        {editing ? (
          <PersonalInfoForm
            initial={{
              first_name: profile.firstName,
              middle_name: profile.middleName,
              last_name: profile.lastName,
              date_of_birth: profile.dateOfBirth,
              marital_status: profile.maritalStatus,
              filing_status: filingStatus,
              phone_number: profile.phone,
              ssn: profile.ssn,
              street_address: profile.street,
              city: profile.city,
              state_province: profile.state,
              postal_code: profile.zip,
            }}
            busy={savingPersonal}
            submitLabel="Save personal info"
            onSubmit={savePersonal}
          />
        ) : (
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <ReadRow label="Full name" value={fullName} />
            <ReadRow label="Social Security number" value={maskTail(profile.ssn)} />
            <ReadRow label="Date of birth" value={profile.dateOfBirth || "—"} />
            <ReadRow label="Filing status" value={filingStatus || "—"} />
            <ReadRow label="Marital status" value={profile.maritalStatus || "—"} />
            <ReadRow label="Phone" value={profile.phone || "—"} />
            <ReadRow label="Home address" value={address} full />
          </dl>
        )}
      </SectionCard>

      {/* Spouse */}
      {showSpouse && (
        <SectionCard icon={Users} title="Spouse">
          {editing ? (
            <SpouseSection mode={spouseMode} />
          ) : spouse ? (
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <ReadRow label="Name" value={[spouse.firstName, spouse.lastName].filter(Boolean).join(" ") || "—"} />
              <ReadRow label="Social Security number" value={maskTail(spouse.ssn)} />
              {spouseMode === "full" && <ReadRow label="Date of birth" value={spouse.dateOfBirth || "—"} />}
              {spouseMode === "full" && <ReadRow label="Earned income" value={money(spouse.earnedIncome)} />}
            </dl>
          ) : (
            <EmptyNote>No spouse details added yet.</EmptyNote>
          )}
        </SectionCard>
      )}

      {/* Dependents */}
      {showDependents && (
        <SectionCard icon={Baby} title="Dependents">
          {editing ? (
            <DependentsSection />
          ) : dependents.length ? (
            <ItemList
              items={dependents.map((d) => ({
                id: d.id,
                title: d.fullName || "—",
                sub: [
                  d.relationship || "—",
                  `SSN ${maskTail(d.ssn)}`,
                  d.dateOfBirth || "—",
                  Number(d.careExpenses) > 0 ? `care ${money(d.careExpenses)}` : null,
                  d.isDisabled ? "disabled" : null,
                ].filter(Boolean).join(" · "),
              }))}
            />
          ) : (
            <EmptyNote>No dependents added.</EmptyNote>
          )}
        </SectionCard>
      )}

      {/* Bank */}
      <SectionCard icon={Landmark} title="Bank accounts">
        {editing ? (
          <BankSection />
        ) : banks.length ? (
          <ItemList
            items={banks.map((b) => ({
              id: b.id,
              title: b.bankName || "—",
              sub: `Account ${maskTail(b.accountNumber)} · Routing ${maskTail(b.routingNumber)}`,
            }))}
          />
        ) : (
          <EmptyNote>No bank account added — this is where a refund would be deposited.</EmptyNote>
        )}
      </SectionCard>

      {/* Jobs */}
      <SectionCard icon={Briefcase} title="Jobs & wage documents">
        {editing ? (
          <JobsSection />
        ) : (
          <div className="space-y-5">
            {jobs.length ? (
              <ItemList
                items={jobs.map((j) => ({
                  id: j.id,
                  title: j.occupation || "—",
                  sub: [
                    j.companyName || "—",
                    (() => {
                      const n = documents.filter((doc) => doc.jobId === j.id).length;
                      return n ? `${n} document${n > 1 ? "s" : ""}` : "no documents yet";
                    })(),
                  ].join(" · "),
                }))}
              />
            ) : (
              <EmptyNote>No jobs added.</EmptyNote>
            )}
            {(() => {
              const wageDocs = documents.filter((d) =>
                ["w2", "form_1099"].includes(d.docType ?? ""),
              );
              if (!wageDocs.length) return null;
              const jobName = (id: number | null) =>
                jobs.find((j) => j.id === id)?.companyName || null;
              return (
                <div>
                  <SubHeading>Wage documents ({wageDocs.length})</SubHeading>
                  <ItemList
                    items={wageDocs.map((d) => ({
                      id: d.id,
                      title: [docLabel(d.docType), jobName(d.jobId)].filter(Boolean).join(" — "),
                      sub: d.name,
                      href: `/api/files/${d.id}`,
                    }))}
                  />
                  <p className="mt-1.5 text-[11px] text-zinc-400">
                    Tap a document to view it. To replace or remove one, use Edit.
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </SectionCard>

      {/* Business */}
      <SectionCard icon={Building2} title="Business">
        {editing ? (
          <CompaniesSection initialOwns={props.ownsEstablishment ?? undefined} />
        ) : companies.length ? (
          <ItemList
            items={companies.map((c) => ({
              id: c.id,
              title: c.companyName || "—",
              sub: [
                c.ein ? `EIN ${c.ein}` : null,
                c.net !== null ? `net ${money(c.net)}` : null,
                c.activities || null,
              ].filter(Boolean).join(" · "),
            }))}
          />
        ) : props.ownsEstablishment === false ? (
          <EmptyNote>You indicated you don&apos;t own a business for {year}.</EmptyNote>
        ) : (
          <EmptyNote>No companies added.</EmptyNote>
        )}
      </SectionCard>

      {/* Documents */}
      <SectionCard icon={FileText} title="Identity documents">
        {editing ? (
          <div className="space-y-3">
            <DocUpload docType="ssn_copy" label="SSN document" />
            {spouseMode === "full" && showSpouse && (
              <DocUpload docType="spouse_ssn_copy" label="Spouse SSN document" />
            )}
          </div>
        ) : (
          (() => {
            const idDocs = documents.filter((d) =>
              ["ssn_copy", "spouse_ssn_copy"].includes(d.docType ?? ""),
            );
            return idDocs.length ? (
              <div>
                <ItemList
                  items={idDocs.map((d) => ({
                    id: d.id,
                    title: docLabel(d.docType),
                    sub: d.name,
                    href: `/api/files/${d.id}`,
                  }))}
                />
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  Tap a document to view it. To replace or remove one, use Edit.
                </p>
              </div>
            ) : (
              <EmptyNote>No identity documents uploaded.</EmptyNote>
            );
          })()
        )}
      </SectionCard>
    </div>
  );
}

function docLabel(t: string | null): string {
  switch (t) {
    case "ssn_copy": return "SSN document";
    case "spouse_ssn_copy": return "Spouse SSN document";
    case "w2": return "W-2";
    case "form_1099": return "1099";
    default: return "Document";
  }
}

function StatusBadge({ status, approved, submitted }: { status: string; approved: boolean; submitted: boolean }) {
  if (approved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
      </span>
    );
  }
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        <Clock className="h-3.5 w-3.5" /> Submitted · pending review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
      <Pencil className="h-3.5 w-3.5" /> In progress
    </span>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReadRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{children}</h3>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      {children}
    </p>
  );
}

function ItemList({
  items,
}: {
  items: { id: number; title: string; sub: string; href?: string }[];
}) {
  return (
    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
      {items.map((it) => (
        <li key={it.id}>
          {it.href ? (
            <a
              href={it.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-500/5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{it.title}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{it.sub}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Eye className="h-3.5 w-3.5" /> View
              </span>
            </a>
          ) : (
            <div className="px-3.5 py-2.5">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{it.title}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{it.sub}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
