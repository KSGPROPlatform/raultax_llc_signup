"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
  Eye,
  Pencil,
  Trash2,
  MoreVertical,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import type { Declaration } from "@/lib/profileData";
import { allowedTaxYears } from "@/lib/taxYear";
import { useToast } from "@/components/ui/Toast";
import { FEE_LABEL, netRefundAfterFee } from "@/lib/firm";

// The dashboard's tax-declaration hub. One row per started year:
//   - row click (or Actions -> View) opens the read-only review
//   - Actions menu: View / Edit / View Form 1040 (submitted) / Delete
//   - primary button: Continue (incomplete) or Submit (complete draft)
//   - Delete asks for explicit confirmation that NAMES the year and what goes.
export function DeclarationsCard() {
  const router = useRouter();
  const toast = useToast();
  const [decls, setDecls] = useState<Declaration[] | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Per-year result for submitted declarations (released after approval).
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

  // Close any open menu when clicking elsewhere.
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (menuFor === null) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuFor]);

  if (!decls) return null;

  // Per-year progress, DYNAMIC by that year's filing status.
  const rowPct = (r: Declaration) => {
    const fs = (r.filing_status ?? "").trim();
    const needsSpouse =
      fs === "Married filing jointly" || fs === "Married filing separately";
    const items = [
      Boolean(fs),
      ...(needsSpouse ? [(r.spouse ?? 0) > 0] : []),
      (r.jobs ?? 0) > 0,
      (r.bank_accounts ?? 0) > 0,
      (r.companies ?? 0) > 0 || r.owns_establishment === false,
    ];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  };

  const started = new Set(decls.map((r) => r.tax_year));
  const remaining = allowedTaxYears().filter((y) => !started.has(y));

  function openReview(year: number, edit = false) {
    router.push(`/dashboard/declaration/${year}${edit ? "?edit=1" : ""}`);
  }

  async function submitYear(year: number) {
    if (!confirm(`Submit your ${year} tax declaration? You can still review it afterwards.`)) return;
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
        toast.error(d.error || `Could not submit your ${year} declaration.`);
        return;
      }
      setDecls((prev) =>
        (prev ?? []).map((r) => (r.tax_year === year ? { ...r, status: "submitted" } : r)),
      );
      toast.success(`Your ${year} declaration was submitted for review.`);
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error — please try again.");
    } finally {
      setBusyYear(null);
    }
  }

  async function deleteYear(year: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/declarations/${year}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || `Could not delete your ${year} declaration.`);
        return;
      }
      setDecls((prev) => (prev ?? []).filter((r) => r.tax_year !== year));
      toast.success(`Your ${year} declaration was deleted.`);
      router.refresh();
    } catch {
      toast.error("Network error — the declaration was not deleted.");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  // Make the chosen year active, then enter its journey (onboarding stepper).
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

  // First visit: nothing started yet — one clear call to action.
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

  const confirmRow = confirmDelete !== null ? decls.find((r) => r.tax_year === confirmDelete) : null;

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
              router.push("/onboarding?new=1");
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" /> Declare tax
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Select a year to review everything you entered — use Actions to view, edit or delete.
      </p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 space-y-2">
        {decls.map((r) => {
          const isActive = r.tax_year === activeYear;
          const pct = rowPct(r);
          const complete = pct === 100;
          const submitted = r.status === "submitted";
          const result = results[r.tax_year];
          return (
            <li
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => openReview(r.tax_year)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openReview(r.tax_year);
                }
              }}
              className={`group flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5 ${
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
                  {submitted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Submitted
                    </span>
                  )}
                </div>
                {submitted ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {result?.status === "approved"
                      ? (result.refund ?? 0) > 0
                        ? netRefundAfterFee(Number(result.refund)) !== null
                          ? `Approved — refund $${Number(result.refund).toLocaleString()} · you'll receive $${Number(netRefundAfterFee(Number(result.refund))).toLocaleString()} after our ${FEE_LABEL} fee`
                          : `Approved — refund $${Number(result.refund).toLocaleString()} (our ${FEE_LABEL} preparation fee applies)`
                        : (result.owed ?? 0) > 0
                          ? `Approved — you owe $${Number(result.owed).toLocaleString()} + our ${FEE_LABEL} preparation fee`
                          : "Approved — balanced"
                      : "Awaiting preparer review"}
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{pct}%</span>
                  </div>
                )}
              </div>

              {/* Primary CTA + Actions */}
              <div
                className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {!submitted && !complete && (
                  <button
                    type="button"
                    disabled={busyYear !== null}
                    onClick={() => go(r.tax_year)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
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
                {!submitted && complete && (
                  <button
                    type="button"
                    disabled={busyYear !== null}
                    onClick={() => submitYear(r.tax_year)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> Submit
                  </button>
                )}

                {/* Actions menu */}
                <div className="relative" ref={menuFor === r.tax_year ? menuRef : undefined}>
                  <button
                    type="button"
                    aria-label={`Actions for tax year ${r.tax_year}`}
                    aria-expanded={menuFor === r.tax_year}
                    onClick={() => setMenuFor(menuFor === r.tax_year ? null : r.tax_year)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <MoreVertical className="h-4 w-4" /> Actions
                  </button>
                  {menuFor === r.tax_year && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      <MenuItem
                        icon={Eye}
                        label="View declaration"
                        onClick={() => {
                          setMenuFor(null);
                          openReview(r.tax_year);
                        }}
                      />
                      <MenuItem
                        icon={Pencil}
                        label="Edit declaration"
                        onClick={() => {
                          setMenuFor(null);
                          openReview(r.tax_year, true);
                        }}
                      />
                      {submitted && (
                        <MenuItem
                          icon={FileDown}
                          label="View Form 1040"
                          onClick={() => {
                            setMenuFor(null);
                            router.push(`/dashboard/return?year=${r.tax_year}`);
                          }}
                        />
                      )}
                      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                      <MenuItem
                        icon={Trash2}
                        label="Delete declaration"
                        danger
                        onClick={() => {
                          setMenuFor(null);
                          setConfirmDelete(r.tax_year);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Delete confirmation — names the year and spells out what is removed. */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setConfirmDelete(null)} aria-hidden />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Delete your {confirmDelete} declaration?
                </h3>
                <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  This permanently removes everything you entered for{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{confirmDelete}</span>
                  {": "}
                  {(() => {
                    const parts: string[] = [];
                    if (confirmRow) {
                      if ((confirmRow.dependents ?? 0) > 0) parts.push(`${confirmRow.dependents} dependent${(confirmRow.dependents ?? 0) > 1 ? "s" : ""}`);
                      if ((confirmRow.jobs ?? 0) > 0) parts.push(`${confirmRow.jobs} job${(confirmRow.jobs ?? 0) > 1 ? "s" : ""}`);
                      if ((confirmRow.companies ?? 0) > 0) parts.push(`${confirmRow.companies} compan${(confirmRow.companies ?? 0) > 1 ? "ies" : "y"}`);
                      if ((confirmRow.bank_accounts ?? 0) > 0) parts.push(`${confirmRow.bank_accounts} bank account${(confirmRow.bank_accounts ?? 0) > 1 ? "s" : ""}`);
                    }
                    parts.push(`that year's W-2/1099 documents and calculations`);
                    return parts.join(", ") + ".";
                  })()}{" "}
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => deleteYear(confirmDelete)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete {confirmDelete} declaration
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}
