"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { MaskedField } from "@/components/forms/MaskedField";

export type CompanyValues = {
  company_name: string;
  ein: string;
  activities: string;
};

const EMPTY: CompanyValues = {
  company_name: "",
  ein: "",
  activities: "",
};

// One company / establishment (Form 4). Shared by onboarding + dashboard.
export function CompanyForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel = "Save company",
}: {
  initial?: Partial<CompanyValues>;
  onSubmit: (v: CompanyValues) => void;
  onCancel?: () => void;
  busy?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<CompanyValues>({ ...EMPTY, ...initial });
  const set =
    (k: keyof CompanyValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k: keyof CompanyValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field id="co_name" label="Company name" required maxLength={256} value={v.company_name} onChange={set("company_name")} autoComplete="off" />
      <MaskedField id="co_ein" label="EIN" placeholder="12-3456789" required maxLength={16} value={v.ein} onChange={setVal("ein")} />
      <Field id="co_activities" label="Activities" placeholder="e.g. Hair dresser" required maxLength={256} value={v.activities} onChange={set("activities")} autoComplete="off" />
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
