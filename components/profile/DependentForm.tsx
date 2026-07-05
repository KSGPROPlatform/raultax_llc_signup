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
};

const EMPTY: DependentValues = {
  full_name: "",
  ssn: "",
  date_of_birth: "",
  relationship: "",
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
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
