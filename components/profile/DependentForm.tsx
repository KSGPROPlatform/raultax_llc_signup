"use client";

import { useState } from "react";
import { Field, SelectField, FormButtons } from "@/components/forms/Field";

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
  const set =
    (k: keyof DependentValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field id="dep_full_name" label="Full name" required maxLength={256} value={v.full_name} onChange={set("full_name")} autoComplete="off" />
      <Field id="dep_ssn" label="Social Security number" required maxLength={32} value={v.ssn} onChange={set("ssn")} autoComplete="off" hint="Stored securely on your account." />
      <Field id="dep_dob" label="Date of birth" placeholder="DD/MM/YY" required maxLength={32} value={v.date_of_birth} onChange={set("date_of_birth")} autoComplete="off" />
      <SelectField id="dep_rel" label="Relationship" required value={v.relationship} onChange={set("relationship")} options={RELATIONSHIPS} />
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
