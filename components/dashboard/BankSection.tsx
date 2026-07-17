"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import type { BankAccount } from "@/lib/profileData";
import { BankForm, type BankValues } from "@/components/profile/BankForm";
import { maskTail } from "@/components/profile/mask";
import { Modal } from "@/components/dashboard/Modal";
import { FirmBankCard } from "@/components/dashboard/FirmBankCard";
import {
  AddButton,
  ListContainer,
  ListRow,
  SectionEmpty,
  SectionError,
  SectionSkeleton,
} from "@/components/dashboard/sectionUI";

// Form 3 manager — used both in the dashboard card and the onboarding step.
// `onStatusChange` reports whether the step is complete (>= 1 account), so the
// onboarding stepper can gate its Continue button.
export function BankSection({
  onStatusChange,
}: {
  onStatusChange?: (done: boolean) => void;
}) {
  const [rows, setRows] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankAccount | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onStatusChange?.(rows.length > 0);
  }, [rows.length, onStatusChange]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/bank-accounts");
        if (res.ok) {
          const data = await res.json();
          if (active) setRows(data.rows ?? []);
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

  async function save(v: BankValues) {
    setBusy(true);
    setError(null);
    try {
      const id = editing && editing !== "new" ? editing.id : undefined;
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...v }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the account.");
        return;
      }
      const row = data.row as BankAccount;
      setRows((prev) => (id ? prev.map((r) => (r.id === id ? row : r)) : [row, ...prev]));
      setEditing(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BankAccount) {
    if (!confirm(`Remove ${row.bank_name || "this account"}?`)) return;
    const res = await fetch(`/api/bank-accounts/${row.id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
    else setError("Could not remove the account.");
  }

  return (
    <div className="space-y-4">
      <FirmBankCard />

      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Your bank account (for your refund)
      </p>

      {error && <SectionError message={error} />}

      {loading ? (
        <SectionSkeleton />
      ) : rows.length ? (
        <ListContainer>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              icon={Landmark}
              title={r.bank_name || "—"}
              subtitle={`Acct ${maskTail(r.account_number)} · Routing ${maskTail(r.routing_number)}`}
              onEdit={() => setEditing(r)}
              onDelete={() => remove(r)}
            />
          ))}
        </ListContainer>
      ) : (
        <SectionEmpty text="No bank account added yet." />
      )}

      <AddButton label="Add bank account" onClick={() => setEditing("new")} />

      {editing && (
        <Modal
          title={editing === "new" ? "Add bank account" : "Edit bank account"}
          onClose={() => setEditing(null)}
        >
          <BankForm
            initial={editing !== "new" ? editing : undefined}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  );
}
