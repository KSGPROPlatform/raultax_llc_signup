"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Inbox } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { UserDetailModal } from "@/components/dashboard/AdminOverview";

type QueueRow = {
  owner_oid: string;
  tax_year: number;
  status: string;
  filing_status: string | null;
  assigned_reviewer_oid: string | null;
  user_name: string | null;
  user_email: string | null;
  reviewer_name: string | null;
  frozen: boolean | null;
};

type Reviewer = { entra_object_id: string; name: string | null; email: string | null };

// The admin's declarations queue: every submitted year across all clients,
// with a per-row reviewer assignment. Assigning hands the declaration to that
// reviewer's queue (they review, adjust, approve).
export function AdminQueue() {
  const toast = useToast();
  const [openOid, setOpenOid] = useState<string | null>(null);
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [q, t] = await Promise.all([
          fetch("/api/admin/queue").then((r) => (r.ok ? r.json() : { rows: [] })),
          fetch("/api/admin/team").then((r) => (r.ok ? r.json() : { reviewers: [] })),
        ]);
        if (!active) return;
        setRows(q.rows ?? []);
        setReviewers(t.reviewers ?? []);
      } catch {
        if (active) setRows([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function assign(row: QueueRow, reviewerOid: string) {
    const key = `${row.owner_oid}-${row.tax_year}`;
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oid: row.owner_oid,
          taxYear: row.tax_year,
          reviewerOid: reviewerOid || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Could not assign the reviewer.");
        return;
      }
      const rv = reviewers.find((r) => r.entra_object_id === reviewerOid);
      setRows((prev) =>
        (prev ?? []).map((r) =>
          r.owner_oid === row.owner_oid && r.tax_year === row.tax_year
            ? { ...r, assigned_reviewer_oid: reviewerOid || null, reviewer_name: rv?.name ?? null }
            : r,
        ),
      );
      toast.success(
        reviewerOid
          ? `${row.user_name || "Declaration"} (${row.tax_year}) assigned to ${rv?.name || "reviewer"}.`
          : `Assignment removed for ${row.user_name || "declaration"} (${row.tax_year}).`,
      );
    } catch {
      toast.error("Network error — nothing was assigned.");
    } finally {
      setBusyKey(null);
    }
  }

  const submitted = (rows ?? []).filter((r) => r.status === "submitted");

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Declarations queue
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {submitted.length} submitted
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Hand each submitted declaration to a reviewer — they check it, adjust if
        needed, and approve it from their own dashboard.
      </p>

      {rows === null ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : submitted.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
          <Inbox className="h-8 w-8 text-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No submitted declarations yet.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {submitted.map((r) => {
            const key = `${r.owner_oid}-${r.tax_year}`;
            return (
              <li
                key={key}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setOpenOid(r.owner_oid)}
                    className="text-left text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {r.user_name || r.user_email || "—"}
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      Tax year {r.tax_year}
                    </span>
                  </button>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {r.user_email || ""}{r.filing_status ? ` · ${r.filing_status}` : ""}
                  </p>
                </div>

                {r.frozen ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" /> Awaiting review
                  </span>
                )}

                <label className="flex w-full items-center gap-2 sm:w-auto">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Reviewer</span>
                  <select
                    value={r.assigned_reviewer_oid ?? ""}
                    disabled={busyKey === key}
                    onChange={(e) => assign(r, e.target.value)}
                    className="min-w-40 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-500 disabled:opacity-50 sm:flex-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value="">Unassigned</option>
                    {reviewers.map((rv) => (
                      <option key={rv.entra_object_id} value={rv.entra_object_id}>
                        {rv.name || rv.email || rv.entra_object_id}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {openOid && <UserDetailModal oid={openOid} onClose={() => setOpenOid(null)} />}
    </section>
  );
}
