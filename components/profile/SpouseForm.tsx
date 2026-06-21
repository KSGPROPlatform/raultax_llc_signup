"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { ComboField } from "@/components/forms/ComboField";
import { CityField } from "@/components/forms/CityField";
import { US_STATES } from "@/lib/usStates";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";
import { DocUpload } from "@/components/documents/DocUpload";

const STATE_NAMES = US_STATES.map((s) => s.name);

export type SpouseValues = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  ssn: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
};

const EMPTY: SpouseValues = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  ssn: "",
  street_address: "",
  city: "",
  state_province: "",
  postal_code: "",
};

// Spouse form. `mode` is driven by the Form-1 filing status:
//   "full" (Married filing jointly) — name, DOB, SSN, address + spouse SSN doc.
//   "ssn"  (Married filing separately) — the spouse's SSN only.
// onSubmit receives only the fields relevant to the mode, so an SSN-only save
// never wipes a fuller record.
export function SpouseForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel = "Save spouse",
}: {
  mode: "full" | "ssn";
  initial?: Partial<SpouseValues>;
  onSubmit: (v: Partial<SpouseValues>) => void;
  onCancel?: () => void;
  busy?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<SpouseValues>({ ...EMPTY, ...initial });
  const setText =
    (k: keyof SpouseValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const setVal = (k: keyof SpouseValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(mode === "ssn" ? { ssn: v.ssn } : v);
      }}
      className="space-y-4"
    >
      {mode === "full" && (
        <>
          <Field id="sp_first_name" label="Spouse first name" required maxLength={256} value={v.first_name} onChange={setText("first_name")} autoComplete="off" />
          <Field id="sp_last_name" label="Spouse last name" required maxLength={256} value={v.last_name} onChange={setText("last_name")} autoComplete="off" />
          <DateField id="sp_dob" label="Spouse date of birth" required value={v.date_of_birth} onChange={setVal("date_of_birth")} />
        </>
      )}

      <SsnField
        id="sp_ssn"
        label="Spouse Social Security number"
        required
        hint="Stored securely on your account."
        value={v.ssn}
        onChange={setVal("ssn")}
      />

      {mode === "full" && (
        <>
          <DocUpload docType="spouse_ssn_copy" label="Spouse SSN document" />
          <Field id="sp_street_address" label="Spouse street address" required maxLength={256} value={v.street_address} onChange={setText("street_address")} autoComplete="off" />
          <ComboField id="sp_state_province" label="State" required value={v.state_province} onChange={setVal("state_province")} options={STATE_NAMES} />
          <CityField id="sp_city" label="City" required value={v.city} onChange={setVal("city")} state={v.state_province} />
          <Field id="sp_postal_code" label="Postal code" required maxLength={16} value={v.postal_code} onChange={setText("postal_code")} autoComplete="off" />
        </>
      )}

      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
