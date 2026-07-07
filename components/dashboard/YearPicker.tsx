"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import type { Declaration } from "@/lib/profileData";
import { allowedTaxYears } from "@/lib/taxYear";

// "Tax year: 2026 ▾" — the active declaration selector. Picking a year starts
// (or re-opens) that year's declaration and sets it as the context every
// document upload is stamped with. Phase 1 scopes documents; other sections
// become per-year in a later phase.
export function YearPicker() {
  const router = useRouter();
  const years = allowedTaxYears();
  const [selected, setSelected] = useState<number | null>(null);
  const [declared, setDeclared] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/declarations");
        if (res.ok) {
          const d = await res.json();
          if (active) {
            setSelected(d.selectedYear ?? years[0]);
            setDeclared(new Set((d.rows ?? []).map((r: Declaration) => r.tax_year)));
          }
        } else if (active) setSelected(years[0]);
      } catch {
        if (active) setSelected(years[0]);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(year: number) {
    setBusy(true);
    setError(null);
    const prev = selected;
    setSelected(year);
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: year }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not switch the tax year.");
        setSelected(prev);
        return;
      }
      setDeclared((s) => new Set(s).add(year));
      router.refresh();
    } catch {
      setError("Network error.");
      setSelected(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <CalendarDays className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-zinc-500 dark:text-zinc-400">Tax year</span>
        {selected === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
        ) : (
          <select
            value={selected}
            disabled={busy}
            onChange={(e) => choose(Number(e.target.value))}
            aria-label="Tax year being declared"
            className="cursor-pointer bg-transparent font-semibold text-zinc-900 outline-none dark:text-zinc-50"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {declared.has(y) ? " · started" : ""}
              </option>
            ))}
          </select>
        )}
      </label>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
