"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import type { Declaration } from "@/lib/profileData";
import { allowedTaxYears } from "@/lib/taxYear";

type Counts = { bank: number; companies: number; jobs: number; personalDone: boolean };

// The dashboard's tax-declaration hub (replaces the year dropdown + profile
// checklist):
//   - No declarations yet -> a single "Declare your tax" call-to-action (no
//     progress bar) that opens onboarding at the year-selection step.
//   - Otherwise -> one row per started year with its progress and a Continue
//     button (the active year highlighted), plus a "Declare tax" button that
//     opens the year-selection form (started years disabled there); the button
//     hides once every available year is started.
export function DeclarationsCard({
  onboardingComplete,
}: {
  onboardingComplete: boolean;
}) {
  const router = useRouter();
  const [decls, setDecls] = useState<Declaration[] | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const get = (url: string): Promise<Record<string, unknown>> =>
        fetch(url)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
      const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
      const [d, b, c, j, p] = await Promise.all([
        get("/api/declarations"),
        get("/api/bank-accounts"),
        get("/api/companies"),
        get("/api/jobs"),
        get("/api/profile/personal"),
      ]);
      if (!active) return;
      setDecls(Array.isArray(d.rows) ? (d.rows as Declaration[]) : []);
      setActiveYear(typeof d.selectedYear === "number" ? d.selectedYear : null);
      const profile = (p.profile ?? {}) as Record<string, string>;
      setCounts({
        bank: len(b.rows),
        companies: len(c.rows),
        jobs: len(j.rows),
        personalDone: Boolean((profile.date_of_birth ?? "").trim()),
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!decls || !counts) return null;

  // Phase 1: profile data is shared across years, so every row shows the same
  // progress; it becomes truly per-year when the tables are year-scoped.
  const items = [
    counts.personalDone,
    counts.jobs > 0,
    counts.bank > 0,
    counts.companies > 0,
  ];
  const pct = onboardingComplete
    ? 100
    : Math.round((items.filter(Boolean).length / items.length) * 100);

  const started = new Set(decls.map((r) => r.tax_year));
  const remaining = allowedTaxYears().filter((y) => !started.has(y));

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
          const complete = pct === 100;
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
              {complete ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyYear !== null}
                  onClick={() => go(r.tax_year)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {busyYear === r.tax_year ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
