"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, ArrowRight, CheckCircle2, Loader2, Send, Eye } from "lucide-react";
import type { Declaration } from "@/lib/profileData";
import { allowedTaxYears } from "@/lib/taxYear";

// The dashboard's tax-declaration hub (replaces the year dropdown + profile
// checklist):
//   - No declarations yet -> a single "Declare your tax" call-to-action (no
//     progress bar) that opens onboarding at the year-selection step.
//   - Otherwise -> one row per started year with its OWN per-year progress
//     (section counts come back with each declaration) and a Continue button
//     (the active year highlighted), plus a "Declare tax" button that opens the
//     year-selection form (started years disabled there); the button hides once
//     every available year is started.
export function DeclarationsCard() {
  const router = useRouter();
  const [decls, setDecls] = useState<Declaration[] | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per-year result for submitted declarations: numbers appear only once the
  // preparer approves (status "approved"), else "in_review".
  const [results, setResults] = useState<Record<number, { status: string; refund?: number | null; owed?: number | null }>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/declarations");
        const d = res.ok ? await res.json() : {};
        if (!active) return;
        const rows = Array.isArray(d.rows) ? (d.rows as Declaration[]) : [];
        setDecls(rows);
        setActiveYear(typeof d.selectedYear === "number" ? d.selectedYear : null);
        // Fetch the review status/result for submitted years.
        const submitted = rows.filter((r) => r.status === "submitted");
        const entries = await Promise.all(
          submitted.map(async (r) => {
            try {
              const t = await fetch(`/api/tax-return?year=${r.tax_year}`);
              const j = t.ok ? await t.json() : {};
              return [r.tax_year, { status: j.status ?? "none", refund: j.refund, owed: j.owed }] as const;
            } catch {
              return [r.tax_year, { status: "none" }] as const;
            }
          }),
        );
        if (active) setResults(Object.fromEntries(entries));
      } catch {
        if (active) setDecls([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!decls) return null;

  // Per-year progress, DYNAMIC by that year's filing status (mirrors the
  // onboarding steps):
  //  - personal: that year's filing status is saved
  //  - spouse:   only counted for Married filing jointly/separately
  //  - business: a company exists OR the user answered "No establishment"
  //  - dependents are optional and never block 100%
  const rowPct = (r: Declaration) => {
    const fs = (r.filing_status ?? "").trim();
    const needsSpouse =
      fs === "Married filing jointly" || fs === "Married filing separately";
    const items = [
      Boolean(fs), // personal (per-year)
      ...(needsSpouse ? [(r.spouse ?? 0) > 0] : []),
      (r.jobs ?? 0) > 0,
      (r.bank_accounts ?? 0) > 0,
      (r.companies ?? 0) > 0 || r.owns_establishment === false,
    ];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  };

  const started = new Set(decls.map((r) => r.tax_year));
  const remaining = allowedTaxYears().filter((y) => !started.has(y));

  // Mark a finished year's declaration as submitted.
  async function submitYear(year: number) {
    if (!confirm(`Submit your ${year} tax declaration? You can still view it afterwards.`)) return;
    setBusyYear(year);
    setError(null);
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: year, status: "submitted" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not submit the declaration.");
        return;
      }
      setDecls((prev) =>
        (prev ?? []).map((r) => (r.tax_year === year ? { ...r, status: "submitted" } : r)),
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyYear(null);
    }
  }

  // Make the chosen year active, then enter its journey.
  async function go(year: number) {
    setBusyYear(year);
    setError(null);
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: year }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not open the declaration.");
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyYear(null);
    }
  }

  // First visit: nothing started yet — one clear call to action, no progress UI.
  if (decls.length === 0) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Ready to file your taxes?
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Start a declaration — you&apos;ll pick the tax year, then we&apos;ll walk you
          through everything step by step.
        </p>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={() => {
            router.push("/onboarding");
            router.refresh();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Declare your tax <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    );
  }

  // Declarations exist: the per-year table + "Declare tax" for remaining years.
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          My tax declarations
        </h2>
        {remaining.length > 0 && (
          <button
            type="button"
            onClick={() => {
              // Opens the year-selection form; already-started years render
              // disabled there.
              router.push("/onboarding?new=1");
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" /> Declare tax
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 space-y-2">
        {decls.map((r) => {
          const isActive = r.tax_year === activeYear;
          const pct = rowPct(r);
          const complete = pct === 100;
          const submitted = r.status === "submitted";
          return (
            <li
              key={r.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 ${
                isActive
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Tax year {r.tax_year}
                  {isActive && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Active
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{pct}%</span>
                </div>
              </div>
              {submitted ? (
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Submitted
                    </span>
                    <Link
                      href={`/dashboard/return?year=${r.tax_year}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      <Eye className="h-4 w-4" /> View return
                    </Link>
                  </span>
                  {results[r.tax_year]?.status === "approved" ? (
                    <span className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                      {(results[r.tax_year]?.refund ?? 0) > 0
                        ? `Refund $${Number(results[r.tax_year]?.refund).toLocaleString()}`
                        : (results[r.tax_year]?.owed ?? 0) > 0
                          ? `You owe $${Number(results[r.tax_year]?.owed).toLocaleString()}`
                          : "Balanced — $0"}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-400">Awaiting preparer review</span>
                  )}
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyYear !== null}
                    onClick={() => go(r.tax_year)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {busyYear === r.tax_year ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  {complete && (
                    <button
                      type="button"
                      disabled={busyYear !== null}
                      onClick={() => submitYear(r.tax_year)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Submit
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
