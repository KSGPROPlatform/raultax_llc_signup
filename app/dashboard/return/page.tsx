import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { activeTaxYear } from "@/lib/activeYear";
import { isAllowedTaxYear } from "@/lib/taxYear";
import { computeTaxReturn, getTaxReturn } from "@/lib/tax";
import {
  getUserProfile,
  listDeclarations,
  getSpouse,
  listDependents,
} from "@/lib/profileData";
import { maskTail } from "@/components/profile/mask";
import { FORM_1040_SECTIONS, FORM_1040_STRONG } from "@/lib/form1040Lines";
import { PrintButton } from "@/components/dashboard/PrintButton";

// The user's FILLED Form 1040 for one tax year — their identity, dependents and
// every computed line (preparer overrides applied as the final values). Visible
// right after submission, stamped "Pending preparer review" until approved.
export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const raw = (await searchParams).year;
  const year = raw && isAllowedTaxYear(raw) ? Number(raw) : await activeTaxYear();

  // Refresh the numbers on every view (a frozen return is left untouched).
  await computeTaxReturn(user.sub, year);

  const [row, profile, decls, spouse, dependents] = await Promise.all([
    getTaxReturn(user.sub, year),
    getUserProfile(user.sub),
    listDeclarations(user.sub),
    getSpouse(user.sub, year),
    listDependents(user.sub, year),
  ]);
  const decl = decls.find((d) => d.tax_year === year);

  const fullName =
    [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.name ||
    "—";
  const address = [
    decl?.street_address,
    [decl?.city, decl?.state_province].filter(Boolean).join(", "),
    decl?.postal_code,
  ]
    .filter(Boolean)
    .join(" · ");
  const filingStatus = (decl?.filing_status ?? "").trim() || "—";
  const showSpouse =
    filingStatus === "Married filing jointly" || filingStatus === "Married filing separately";

  const frozen = Boolean(row?.frozen);
  const overrides = (row?.overrides ?? {}) as Record<string, { value?: number }>;
  const eff = (k: string): number | null => {
    const o = Number(overrides[k]?.value);
    if (Number.isFinite(o)) return o;
    const v = Number((row as Record<string, unknown> | null)?.[k]);
    return Number.isFinite(v) ? v : null;
  };
  const money = (v: number | null) =>
    v === null
      ? "—"
      : v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const refund = eff("line_34") ?? 0;
  const owed = eff("line_37") ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/user"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:underline dark:text-zinc-400"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        {row && <PrintButton />}
      </div>

      {!row ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            No return yet for {year}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Complete and submit your {year} declaration first — the filled form appears here.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {/* Status banner */}
          {frozen ? (
            <div className="flex items-center gap-2 rounded-t-xl bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Approved by your tax preparer — these are your final figures.
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-t-xl bg-amber-50 px-6 py-3 text-sm font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock className="h-4 w-4 shrink-0" />
              Pending preparer review — figures may still be adjusted.
            </div>
          )}

          <div className="space-y-6 p-6 sm:p-8">
            {/* Form header */}
            <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Form 1040 · U.S. Individual Income Tax Return
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Tax year {year}
              </h1>
            </header>

            {/* Identity block */}
            <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <IdRow label="Name" value={fullName} />
              <IdRow label="Social Security number" value={maskTail(profile?.ssn)} />
              <IdRow label="Home address" value={address || "—"} />
              <IdRow label="Filing status" value={filingStatus} />
              {showSpouse && (
                <>
                  <IdRow
                    label="Spouse"
                    value={
                      [spouse?.first_name, spouse?.last_name].filter(Boolean).join(" ") || "—"
                    }
                  />
                  <IdRow label="Spouse SSN" value={maskTail(spouse?.ssn)} />
                </>
              )}
            </div>

            {/* Dependents */}
            {dependents.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Dependents
                </h2>
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
                  {dependents.map((d) => (
                    <li key={d.id} className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {d.full_name || "—"}
                      </span>
                      {" · "}
                      {d.relationship || "—"}
                      {" · SSN "}
                      {maskTail(d.ssn)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Computed lines by 1040 section */}
            {FORM_1040_SECTIONS.map((section) => (
              <div key={section.title}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {section.title}
                </h2>
                <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {section.lines.map(([key, label]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-2 text-sm last:border-0 dark:border-zinc-800/60 ${
                        FORM_1040_STRONG.has(key)
                          ? "bg-zinc-50 font-semibold dark:bg-zinc-900/50"
                          : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 text-zinc-600 dark:text-zinc-300">
                        {label}
                      </span>
                      <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                        {money(eff(key))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Outcome */}
            <div
              className={`rounded-xl p-5 text-center ${
                refund > 0
                  ? "bg-emerald-50 dark:bg-emerald-500/10"
                  : owed > 0
                    ? "bg-red-50 dark:bg-red-500/10"
                    : "bg-zinc-50 dark:bg-zinc-900/50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {refund > 0 ? "Your refund" : owed > 0 ? "Amount you owe" : "Balanced"}
              </p>
              <p
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  refund > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : owed > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {money(refund > 0 ? refund : owed > 0 ? owed : 0)}
              </p>
              {!frozen && (
                <p className="mt-1 text-xs text-zinc-400">
                  Estimate — awaiting your preparer&apos;s approval.
                </p>
              )}
            </div>

            <p className="text-center text-[11px] text-zinc-400">
              Generated by raultax from your verified documents and declaration
              {row.computed_at ? ` · ${new Date(String(row.computed_at)).toLocaleString()}` : ""}.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-medium text-zinc-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}
