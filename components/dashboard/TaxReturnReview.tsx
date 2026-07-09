"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, Lock, Unlock, Loader2, Pencil, RotateCcw, AlertTriangle } from "lucide-react";
import type { Declaration } from "@/lib/profileData";

// Preparer's 1040 review panel (inside the admin user modal): pick a year,
// see every computed line with its label, override any value (audited), see
// the flags, recompute, and Approve & freeze — freezing releases the headline
// numbers to the user and stops recomputation.

const LINES: [string, string][] = [
  ["line_1a", "1a — Wages (W-2 box 1)"],
  ["line_1z", "1z — Total wages"],
  ["line_8", "8 — Additional income (Sch 1)"],
  ["line_9", "9 — Total income"],
  ["line_10", "10 — Adjustments (½ SE tax)"],
  ["line_11a", "11a — Adjusted gross income"],
  ["line_12e", "12e — Standard deduction"],
  ["line_13a", "13a — QBI deduction (8995)"],
  ["line_13b", "13b — Additional deductions (Sch 1-A)"],
  ["line_14", "14 — Total deductions"],
  ["line_15", "15 — Taxable income"],
  ["line_16", "16 — Tax"],
  ["line_18", "18 — Tax before credits"],
  ["line_19", "19 — Child tax credit (8812)"],
  ["line_22", "22 — Tax after credits"],
  ["line_23", "23 — Other taxes (SE)"],
  ["line_24", "24 — TOTAL TAX"],
  ["line_25a", "25a — W-2 withholding"],
  ["line_25b", "25b — 1099 withholding"],
  ["line_25d", "25d — Total withholding"],
  ["line_26", "26 — Estimated payments"],
  ["line_28", "28 — Additional CTC"],
  ["line_32", "32 — Other payments/credits"],
  ["line_33", "33 — TOTAL PAYMENTS"],
  ["line_34", "34 — REFUND"],
  ["line_37", "37 — AMOUNT OWED"],
];

type ReturnRow = Record<string, unknown> & {
  flags?: string[];
  overrides?: Record<string, { value: number; by?: string; at?: string }>;
  frozen?: boolean;
  computed_at?: string;
};

const money = (v: unknown) =>
  Number.isFinite(Number(v))
    ? Number(v).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

export function TaxReturnReview({ oid }: { oid: string }) {
  const [decls, setDecls] = useState<Declaration[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [row, setRow] = useState<ReturnRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/declarations?oid=${encodeURIComponent(oid)}`);
        const d = res.ok ? await res.json() : {};
        if (!active) return;
        const rows = (d.rows ?? []) as Declaration[];
        setDecls(rows);
        if (rows.length) setYear(rows[0].tax_year);
        else setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [oid]);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tax-return?oid=${encodeURIComponent(oid)}&year=${y}`);
      const d = res.ok ? await res.json() : {};
      setRow((d.return ?? null) as ReturnRow | null);
    } catch {
      setError("Could not load the return.");
    } finally {
      setLoading(false);
    }
  }, [oid]);

  useEffect(() => {
    if (year !== null) load(year);
  }, [year, load]);

  async function recompute() {
    if (year === null) return;
    setBusy("compute");
    setError(null);
    try {
      const res = await fetch(`/api/admin/tax-return?oid=${encodeURIComponent(oid)}&year=${year}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Computation failed.");
      else if (d.frozen) setError("This return is frozen — unfreeze to recompute.");
      await load(year);
    } finally {
      setBusy(null);
    }
  }

  async function patch(body: Record<string, unknown>) {
    if (year === null) return;
    setBusy("patch");
    setError(null);
    try {
      const res = await fetch(`/api/admin/tax-return?oid=${encodeURIComponent(oid)}&year=${year}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Update failed.");
      }
      await load(year);
    } finally {
      setBusy(null);
    }
  }

  if (!decls.length && !loading) {
    return <p className="text-sm text-zinc-400">No declarations yet.</p>;
  }

  const overrides = row?.overrides ?? {};
  const frozen = Boolean(row?.frozen);

  return (
    <div className="space-y-3">
      {/* Year pills + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {decls.map((d) => (
          <button
            key={d.tax_year}
            type="button"
            onClick={() => setYear(d.tax_year)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              d.tax_year === year
                ? "bg-amber-500 text-zinc-950"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {d.tax_year}
            {d.status === "submitted" ? " · submitted" : ""}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          disabled={busy !== null || frozen}
          onClick={recompute}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {busy === "compute" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
          Recompute
        </button>
        {row && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (frozen || confirm("Approve this return? The numbers freeze and are released to the client.")) {
                patch({ frozen: !frozen });
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              frozen
                ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {frozen ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {frozen ? "Unfreeze" : "Approve & freeze"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {frozen && (
        <p className="rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          Approved & frozen — the client can see the result. Unfreeze to change anything.
        </p>
      )}

      {loading ? (
        <div className="grid place-items-center py-8 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !row ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Not computed yet — click <span className="font-medium">Recompute</span>.
        </div>
      ) : (
        <>
          {/* Flags */}
          {(row.flags ?? []).length > 0 && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-500/10">
              {(row.flags ?? []).map((f, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {f}
                </p>
              ))}
            </div>
          )}

          {/* Line table */}
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            {LINES.map(([key, label]) => {
              const computed = row[key];
              const ov = overrides[key];
              if (!Number.isFinite(Number(computed)) && !ov) return null;
              const isEditing = editing === key;
              const strong = ["line_24", "line_33", "line_34", "line_37"].includes(key);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 border-b border-zinc-100 px-3 py-1.5 text-sm last:border-0 dark:border-zinc-800/60 ${
                    strong ? "bg-zinc-50 font-semibold dark:bg-zinc-900/50" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{label}</span>
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = Number(editVal);
                        setEditing(null);
                        if (Number.isFinite(v)) patch({ overrides: { [key]: v } });
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={() => setEditing(null)}
                        className="w-28 rounded border border-amber-400 bg-white px-1.5 py-0.5 text-right text-sm tabular-nums outline-none dark:bg-zinc-900"
                      />
                    </form>
                  ) : (
                    <>
                      {ov ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-400 line-through">{money(computed)}</span>
                          <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400" title={`Override by ${ov.by ?? "admin"}`}>
                            {money(ov.value)}
                          </span>
                          {!frozen && (
                            <button type="button" onClick={() => patch({ overrides: { [key]: null } })} aria-label="Remove override" className="text-zinc-400 hover:text-red-500">
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{money(computed)}</span>
                      )}
                      {!frozen && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(key);
                            setEditVal(String(ov?.value ?? (Number.isFinite(Number(computed)) ? Number(computed) : "")));
                          }}
                          aria-label={`Override ${label}`}
                          className="text-zinc-300 hover:text-amber-500 dark:text-zinc-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {row.computed_at ? (
            <p className="text-right text-[11px] text-zinc-400">
              computed {new Date(String(row.computed_at)).toLocaleString()}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
