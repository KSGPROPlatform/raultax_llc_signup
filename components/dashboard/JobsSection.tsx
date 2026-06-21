"use client";

import { useEffect, useState } from "react";
import { Briefcase, Pencil, Trash2 } from "lucide-react";
import type { Job } from "@/lib/profileData";
import { Field, FormButtons } from "@/components/forms/Field";
import { Modal } from "@/components/dashboard/Modal";
import {
  AddButton,
  SectionEmpty,
  SectionError,
  SectionSkeleton,
} from "@/components/dashboard/sectionUI";
import { DocUpload } from "@/components/documents/DocUpload";

// Jobs manager — one user has many jobs; each job has its own W-2 + 1099.
// Used in the onboarding "Jobs" step and the dashboard.
export function JobsSection() {
  const [rows, setRows] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Job | "new" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/jobs");
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
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = editing && editing !== "new" ? editing.id : undefined;
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, job_name: name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not save the job.");
        return;
      }
      const row = d.row as Job;
      setRows((prev) => (id ? prev.map((r) => (r.id === id ? row : r)) : [row, ...prev]));
      setEditing(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(j: Job) {
    if (!confirm(`Remove "${j.job_name || "this job"}" and unlink its documents?`)) return;
    const res = await fetch(`/api/jobs/${j.id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== j.id));
    else setError("Could not remove the job.");
  }

  return (
    <div className="space-y-4">
      {error && <SectionError message={error} />}

      {loading ? (
        <SectionSkeleton />
      ) : rows.length ? (
        <div className="space-y-4">
          {rows.map((j) => (
            <div
              key={j.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {j.job_name || "Untitled job"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setName(j.job_name);
                    setEditing(j);
                  }}
                  aria-label="Edit job"
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(j)}
                  aria-label="Delete job"
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DocUpload docType="w2" jobId={j.id} label={`W-2 — ${j.job_name || "job"}`} />
                <DocUpload docType="form_1099" jobId={j.id} label={`1099 — ${j.job_name || "job"}`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SectionEmpty text="No jobs added yet." />
      )}

      <AddButton label="Add job" onClick={() => { setName(""); setEditing("new"); }} />

      {editing && (
        <Modal title={editing === "new" ? "Add job" : "Edit job"} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            {error && <SectionError message={error} />}
            <Field
              id="job_name"
              label="Job / employer name"
              required
              maxLength={256}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <FormButtons busy={busy} submitLabel="Save job" onCancel={() => setEditing(null)} />
          </form>
        </Modal>
      )}
    </div>
  );
}
