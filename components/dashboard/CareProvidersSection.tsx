"use client";

import { useEffect, useState } from "react";
import { Baby } from "lucide-react";
import type { CareProvider } from "@/lib/profileData";
import { Field, FormButtons } from "@/components/forms/Field";
import { Modal } from "@/components/dashboard/Modal";
import {
  AddButton,
  ListContainer,
  ListRow,
  SectionEmpty,
  SectionError,
  SectionSkeleton,
} from "@/components/dashboard/sectionUI";

// Form 2441 Part I — who provided the care. The IRS makes this part MANDATORY
// whenever childcare expenses are claimed or a W-2 shows dependent-care
// benefits (box 10), so this section lives right under the dependents list.

type ProviderValues = {
  provider_name: string;
  address: string;
  tax_id: string;
  is_household_employee: boolean;
  amount_paid: string;
};

const EMPTY: ProviderValues = {
  provider_name: "",
  address: "",
  tax_id: "",
  is_household_employee: false,
  amount_paid: "",
};

function ProviderForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial?: Partial<ProviderValues>;
  onSubmit: (v: ProviderValues) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState<ProviderValues>({ ...EMPTY, ...initial });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set =
    (k: keyof ProviderValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  const taxIdDigits = v.tax_id.replace(/\D/g, "");
  const errs: Record<string, string | null> = {
    provider_name: v.provider_name.trim() ? null : "The provider's name is required.",
    tax_id:
      v.tax_id && taxIdDigits.length !== 9
        ? "The tax ID must be a 9-digit SSN or EIN."
        : null,
    amount_paid:
      v.amount_paid && !Number.isFinite(Number(v.amount_paid))
        ? "Enter a dollar amount (numbers only)."
        : null,
  };
  const err = (k: string) => (touched[k] ? errs[k] : null);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ provider_name: true, tax_id: true, amount_paid: true });
    if (Object.values(errs).some(Boolean)) return;
    onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field id="cp_name" label="Care provider name" required maxLength={256} placeholder="e.g. Sunny Days Daycare" value={v.provider_name} error={err("provider_name")} onChange={set("provider_name")} onBlur={touch("provider_name")} autoComplete="off" />
      <Field id="cp_address" label="Address" maxLength={512} placeholder="Street, city, state, ZIP" value={v.address} onChange={set("address")} autoComplete="off" />
      <Field id="cp_tax_id" label="Provider tax ID (SSN or EIN)" maxLength={16} placeholder="12-3456789" value={v.tax_id} error={err("tax_id")} onChange={set("tax_id")} onBlur={touch("tax_id")} autoComplete="off" hint="On the provider's invoice or Form W-10." />
      <Field
        id="cp_amount"
        label="Amount paid this tax year ($)"
        maxLength={12}
        placeholder="e.g. 4000"
        value={v.amount_paid}
        error={err("amount_paid")}
        onChange={(e) => setV((p) => ({ ...p, amount_paid: e.target.value.replace(/[^\d.]/g, "") }))}
        onBlur={touch("amount_paid")}
        autoComplete="off"
      />
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={v.is_household_employee}
          onChange={(e) => setV((p) => ({ ...p, is_household_employee: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-amber-500"
        />
        <span>
          This provider worked in my home (household employee — e.g. a nanny,
          not a daycare center)
        </span>
      </label>
      <FormButtons busy={busy} submitLabel="Save provider" onCancel={onCancel} />
    </form>
  );
}

export function CareProvidersSection() {
  const [rows, setRows] = useState<CareProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CareProvider | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/care-providers");
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

  async function save(v: ProviderValues) {
    setBusy(true);
    setError(null);
    try {
      const id = editing && editing !== "new" ? editing.id : undefined;
      const res = await fetch("/api/care-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...v }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the care provider.");
        return;
      }
      const row = data.row as CareProvider;
      setRows((prev) => (id ? prev.map((r) => (r.id === id ? row : r)) : [row, ...prev]));
      setEditing(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CareProvider) {
    if (!confirm(`Remove ${row.provider_name || "this provider"}?`)) return;
    const res = await fetch(`/api/care-providers/${row.id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== row.id));
    else setError("Could not remove the provider.");
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Childcare providers
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Who you paid for childcare. Required by the IRS (Form 2441) when you
          claim childcare expenses or your W-2 shows dependent-care benefits.
        </p>
      </div>

      {error && <SectionError message={error} />}

      {loading ? (
        <SectionSkeleton />
      ) : rows.length ? (
        <ListContainer>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              icon={Baby}
              title={r.provider_name || "—"}
              subtitle={`${r.is_household_employee ? "Household employee" : "Care organization"}${Number(r.amount_paid) > 0 ? ` · paid $${Number(r.amount_paid).toLocaleString()}` : ""}`}
              onEdit={() => setEditing(r)}
              onDelete={() => remove(r)}
            />
          ))}
        </ListContainer>
      ) : (
        <SectionEmpty text="No care providers added yet." />
      )}

      <AddButton label="Add care provider" onClick={() => setEditing("new")} />

      {editing && (
        <Modal
          title={editing === "new" ? "Add care provider" : "Edit care provider"}
          onClose={() => setEditing(null)}
        >
          <ProviderForm
            initial={
              editing !== "new"
                ? {
                    ...editing,
                    amount_paid:
                      editing.amount_paid === null || editing.amount_paid === undefined
                        ? ""
                        : String(editing.amount_paid),
                    is_household_employee: Boolean(editing.is_household_employee),
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
