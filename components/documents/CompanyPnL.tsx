"use client";

import { useEffect, useState } from "react";
import { Trash2, Pencil, Plus, Loader2, X } from "lucide-react";
import type { CompanyLine } from "@/lib/profileData";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

// kind values stay income/expense (the API + net math); the UI labels them
// Profit / Loss per the form's wording.
type Draft = {
  id?: number;
  kind: "income" | "expense";
  description: string;
  amount: string;
};
const EMPTY_DRAFT: Draft = { kind: "income", description: "", amount: "" };

// Per-company profit/loss grid: pick Profit or Loss, a name, and an amount; the
// net updates live. Borderless so it reads as part of the company card.
export function CompanyPnL({ companyId }: { companyId: number }) {
  const [rows, setRows] = useState<CompanyLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/company-lines?companyId=${companyId}`);
        if (res.ok) {
          const d = await res.json();
          if (active) setRows(d.rows ?? []);
        }
      } catch {
        /* leave empty */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId]);

  const net = rows.reduce(
    (s, r) => s + (r.kind === "income" ? Number(r.amount) : -Number(r.amount)),
    0,
  );

  async function save() {
    if (!draft.description.trim() && !draft.amount) {
      setError("Add a name or amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          companyId,
          kind: draft.kind,
          description: draft.description,
          amount: draft.amount,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not save the line.");
        return;
      }
      const row = d.row as CompanyLine;
      setRows((prev) =>
        draft.id ? prev.map((r) => (r.id === draft.id ? row : r)) : [...prev, row],
      );
      setDraft(EMPTY_DRAFT);
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/company-lines/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((p) => p.filter((r) => r.id !== id));
      if (draft.id === id) setDraft(EMPTY_DRAFT);
    } else {
      setError("Could not remove the line.");
    }
  }

  const inp =
    "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Profit / loss
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          Net {money(net)}
        </span>
      </div>

      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <div className="py-2 text-center text-xs text-zinc-400">…</div>
      ) : rows.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  r.kind === "income"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                }`}
              >
                {r.kind === "income" ? "Profit" : "Loss"}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-800 dark:text-zinc-200">
                {r.description || "—"}
              </span>
              <span
                className={`shrink-0 tabular-nums ${
                  r.kind === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {r.kind === "income" ? "+" : "−"}
                {money(Number(r.amount))}
              </span>
              <button type="button" onClick={() => setDraft({ id: r.id, kind: r.kind, description: r.description, amount: String(r.amount) })} aria-label="Edit line" className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => remove(r.id)} aria-label="Delete line" className="shrink-0 text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-1 text-xs text-zinc-400">No profit or loss added yet.</p>
      )}

      {/* Add / edit a line — Profit/Loss · name · amount */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto]">
        <select
          aria-label="Profit or loss"
          value={draft.kind}
          onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as "income" | "expense" }))}
          className={`${inp} cursor-pointer`}
        >
          <option value="income">Profit</option>
          <option value="expense">Loss</option>
        </select>
        <input
          aria-label="Name"
          placeholder="Name (e.g. Farming)"
          maxLength={256}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          className={inp}
        />
        <input
          aria-label="Amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={draft.amount}
          onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          className={`${inp} tabular-nums sm:w-32`}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : draft.id ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {draft.id ? "Update line" : "Add line"}
        </button>
        {draft.id && (
          <button
            type="button"
            onClick={() => setDraft(EMPTY_DRAFT)}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
          >
            <X className="h-3.5 w-3.5" /> Cancel edit
          </button>
        )}
      </div>
    </div>
  );
}
