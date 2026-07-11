"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { Dependent } from "@/lib/profileData";
import { DependentForm, type DependentValues } from "@/components/profile/DependentForm";
import { maskTail } from "@/components/profile/mask";
import { Modal } from "@/components/dashboard/Modal";
import {
  AddButton,
  ListContainer,
  ListRow,
  SectionEmpty,
  SectionError,
  SectionSkeleton,
} from "@/components/dashboard/sectionUI";

// Form 2 manager — used both in the dashboard card and the onboarding step.
export function DependentsSection() {
  const [rows, setRows] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Dependent | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/dependents");
        if (res.ok) {
          const data = await res.json();
          if (active) setRows(data.rows ?? []);
        }
      } catch {
        /* leave empty — the user can still add */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save(v: DependentValues) {
    setBusy(true);
    setError(null);
    try {
      const id = editing && editing !== "new" ? editing.id : undefined;
      const res = await fetch("/api/dependents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...v }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the dependent.");
        return;
      }
      const row = data.row as Dependent;
      setRows((prev) => (id ? prev.map((r) => (r.id === id ? row : r)) : [row, ...prev]));
      setEditing(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Dependent) {
    if (!confirm(`Remove ${row.full_name || "this dependent"}?`)) return;
    const res = await fetch(`/api/dependents/${row.id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
    else setError("Could not remove the dependent.");
  }

  return (
    <div className="space-y-4">
      {error && <SectionError message={error} />}

      {loading ? (
        <SectionSkeleton />
      ) : rows.length ? (
        <ListContainer>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              icon={Users}
              title={r.full_name || "—"}
              subtitle={`${r.relationship || "—"} · SSN ${maskTail(r.ssn)} · ${r.date_of_birth || "—"}${Number(r.care_expenses) > 0 ? ` · care $${Number(r.care_expenses).toLocaleString()}` : ""}`}
              onEdit={() => setEditing(r)}
              onDelete={() => remove(r)}
            />
          ))}
        </ListContainer>
      ) : (
        <SectionEmpty text="No dependents added yet." />
      )}

      <AddButton label="Add dependent" onClick={() => setEditing("new")} />

      {editing && (
        <Modal
          title={editing === "new" ? "Add dependent" : "Edit dependent"}
          onClose={() => setEditing(null)}
        >
          <DependentForm
            initial={
              editing !== "new"
                ? {
                    ...editing,
                    care_expenses:
                      editing.care_expenses === null || editing.care_expenses === undefined
                        ? ""
                        : String(editing.care_expenses),
                    is_disabled: Boolean(editing.is_disabled),
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
