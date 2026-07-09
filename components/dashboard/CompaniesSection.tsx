"use client";

import { useEffect, useState } from "react";
import { Building2, Pencil, Trash2 } from "lucide-react";
import type { Company } from "@/lib/profileData";
import { CompanyForm, type CompanyValues } from "@/components/profile/CompanyForm";
import { Modal } from "@/components/dashboard/Modal";
import { CompanyPnL } from "@/components/documents/CompanyPnL";
import {
  AddButton,
  SectionEmpty,
  SectionError,
  SectionSkeleton,
} from "@/components/dashboard/sectionUI";

// Form 4 manager. Gated by the "do you own an establishment?" answer.
// `initialOwns` seeds the answer (from the active declaration on the dashboard);
// the onboarding step omits it and infers from existing companies.
// `onStatusChange` reports whether the step is complete (answered No, or has a
// company), so the onboarding stepper can gate its Continue button.
export function CompaniesSection({
  initialOwns,
  onStatusChange,
}: {
  initialOwns?: boolean;
  onStatusChange?: (done: boolean) => void;
}) {
  const [owns, setOwns] = useState<boolean | null>(
    initialOwns === undefined ? null : initialOwns,
  );
  const [ownBusy, setOwnBusy] = useState(false);
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onStatusChange?.(owns === false || rows.length > 0);
  }, [owns, rows.length, onStatusChange]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          if (active) {
            const list = (data.rows ?? []) as Company[];
            setRows(list);
            // Infer the answer when it wasn't seeded and rows already exist.
            if (initialOwns === undefined && list.length) setOwns(true);
          }
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
  }, [initialOwns]);

  async function answer(value: boolean) {
    setOwnBusy(true);
    setError(null);
    try {
      await fetch("/api/profile/establishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owns: value }),
      });
      setOwns(value);
    } catch {
      setError("Could not save your answer.");
    } finally {
      setOwnBusy(false);
    }
  }

  async function save(v: CompanyValues) {
    setBusy(true);
    setError(null);
    try {
      const id = editing && editing !== "new" ? editing.id : undefined;
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...v }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the company.");
        return;
      }
      const row = data.row as Company;
      setRows((prev) => (id ? prev.map((r) => (r.id === id ? row : r)) : [row, ...prev]));
      setEditing(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Company) {
    if (!confirm(`Remove ${row.company_name || "this company"}?`)) return;
    const res = await fetch(`/api/companies/${row.id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
    else setError("Could not remove the company.");
  }

  // Ask the gating question.
  if (owns === null) {
    return (
      <div className="space-y-4">
        {error && <SectionError message={error} />}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Do you own an establishment or business?
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            If so, we&apos;ll collect your company details for filing.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={ownBusy}
              onClick={() => answer(true)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              Yes
            </button>
            <button
              type="button"
              disabled={ownBusy}
              onClick={() => answer(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              No
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Answered "No".
  if (owns === false) {
    return (
      <div className="space-y-4">
        {error && <SectionError message={error} />}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-zinc-500 dark:text-zinc-400">
            You indicated you don&apos;t own an establishment.
          </span>
          <button
            type="button"
            onClick={() => setOwns(null)}
            className="font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            Change answer
          </button>
        </div>
      </div>
    );
  }

  // Answered "Yes" — manage companies.
  return (
    <div className="space-y-4">
      {error && <SectionError message={error} />}

      {loading ? (
        <SectionSkeleton />
      ) : rows.length ? (
        <div className="space-y-4">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {r.company_name || "—"}
                  </div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    EIN {r.ein || "—"} · {r.activities || "—"}
                  </div>
                </div>
                <button type="button" onClick={() => setEditing(r)} aria-label="Edit company" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => remove(r)} aria-label="Delete company" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <CompanyPnL companyId={r.id} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SectionEmpty text="No companies added yet." />
      )}

      <div className="flex items-center gap-4">
        <AddButton label="Add company" onClick={() => setEditing("new")} />
        <button
          type="button"
          onClick={() => setOwns(null)}
          className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
        >
          Change answer
        </button>
      </div>

      {editing && (
        <Modal
          title={editing === "new" ? "Add company" : "Edit company"}
          onClose={() => setEditing(null)}
        >
          <CompanyForm
            initial={
              editing !== "new"
                ? {
                    company_name: editing.company_name,
                    ein: editing.ein,
                    activities: editing.activities,
                  }
                : undefined
            }
            onSubmit={save}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  );
}
