"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { ComboField } from "@/components/forms/ComboField";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";
import { validateName, validateSsn, validateDob } from "@/lib/validation";

const RELATIONSHIPS = ["Spouse", "Child", "Parent", "Sibling", "Other dependent"];

export type DependentValues = {
  full_name: string;
  ssn: string;
  date_of_birth: string;
  relationship: string;
  care_expenses: string; // dollars paid for this dependent's care (Form 2441)
  is_disabled: boolean;  // over 12 and unable to self-care (Form 2441 2(c))
};

const EMPTY: DependentValues = {
  full_name: "",
  ssn: "",
  date_of_birth: "",
  relationship: "",
  care_expenses: "",
  is_disabled: false,
};

// One dependent (Form 2). Used in the onboarding stepper and the dashboard
// section's add/edit modal.
export function DependentForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel = "Save dependent",
}: {
  initial?: Partial<DependentValues>;
  onSubmit: (v: DependentValues) => void;
  onCancel?: () => void;
  busy?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<DependentValues>({ ...EMPTY, ...initial });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set =
    (k: keyof DependentValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k: keyof DependentValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  // A dependent can be any age, so the DOB is validated as a real date only (no
  // adult year range), but the SSN must still be valid.
  const errs: Record<string, string | null> = {
    full_name: validateName(v.full_name, "Full name"),
    ssn: validateSsn(v.ssn),
    date_of_birth: validateDob(v.date_of_birth),
    care_expenses:
      v.care_expenses && !Number.isFinite(Number(v.care_expenses))
        ? "Enter a dollar amount (numbers only)."
        : null,
  };
  const err = (k: string) => (touched[k] ? errs[k] : null);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ full_name: true, ssn: true, date_of_birth: true });
    if (Object.values(errs).some(Boolean)) return;
    onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field id="dep_full_name" label="Full name" required maxLength={256} placeholder="e.g. Emma Doe" value={v.full_name} error={err("full_name")} onChange={set("full_name")} onBlur={touch("full_name")} autoComplete="off" />
      <SsnField id="dep_ssn" label="Social Security number" required value={v.ssn} error={err("ssn")} onChange={setVal("ssn")} onBlur={touch("ssn")} hint="Stored securely on your account." />
      <DateField id="dep_dob" label="Date of birth" required value={v.date_of_birth} onChange={setVal("date_of_birth")} onBlur={touch("date_of_birth")} error={err("date_of_birth")} />
      <ComboField id="dep_rel" label="Relationship" required value={v.relationship} onChange={setVal("relationship")} options={RELATIONSHIPS} />
      <Field
        id="dep_care_expenses"
        label="Childcare expenses paid this tax year ($)"
        maxLength={12}
        placeholder="e.g. 4000"
        value={v.care_expenses}
        error={err("care_expenses")}
        onChange={(e) => setVal("care_expenses")(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={touch("care_expenses")}
        autoComplete="off"
        hint="What you paid for this dependent's care so you could work (Form 2441). Leave empty if none — also add the care provider below the list."
      />
      <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={v.is_disabled}
          onChange={(e) => setV((p) => ({ ...p, is_disabled: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-amber-500"
        />
        <span>
          This person is over 12 and physically or mentally unable to care for
          themselves <span className="text-zinc-400">(Form 2441)</span>
        </span>
      </label>
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
