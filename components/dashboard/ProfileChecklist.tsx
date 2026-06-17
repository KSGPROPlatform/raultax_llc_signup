"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

// Dashboard "Tax Home" progress nudge: shows which profile sections are done
// and links back into the guided onboarding journey when something's missing.
export function ProfileChecklist({ ownsEstablishment }: { ownsEstablishment: boolean }) {
  const [counts, setCounts] = useState<{ bank: number; companies: number } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const get = (url: string) =>
        fetch(url)
          .then((r) => (r.ok ? r.json() : { rows: [] }))
          .catch(() => ({ rows: [] }));
      const [b, c] = await Promise.all([
        get("/api/bank-accounts"),
        get("/api/companies"),
      ]);
      if (active) {
        setCounts({ bank: (b.rows ?? []).length, companies: (c.rows ?? []).length });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!counts) return null;

  const items = [
    { label: "Personal information", done: true },
    { label: "Bank information", done: counts.bank > 0 },
    {
      label: ownsEstablishment ? "Company details" : "Business details",
      done: !ownsEstablishment || counts.companies > 0,
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  if (doneCount === items.length) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Your tax profile is complete.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Finish setting up your profile
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {doneCount} of {items.length} sections complete
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Resume setup <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-500/20">
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-xs">
            {i.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
            )}
            <span className={i.done ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}>
              {i.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
