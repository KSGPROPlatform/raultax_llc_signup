"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { ComboField } from "@/components/forms/ComboField";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";

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
  const setVal = (k: keyof DependentValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field id="dep_full_name" label="Full name" required maxLength={256} value={v.full_name} onChange={set("full_name")} autoComplete="off" />
      <SsnField id="dep_ssn" label="Social Security number" required value={v.ssn} onChange={setVal("ssn")} hint="Stored securely on your account." />
      <DateField id="dep_dob" label="Date of birth" required value={v.date_of_birth} onChange={setVal("date_of_birth")} />
      <ComboField id="dep_rel" label="Relationship" required value={v.relationship} onChange={setVal("relationship")} options={RELATIONSHIPS} />
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
