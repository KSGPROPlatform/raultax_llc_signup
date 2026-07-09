"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { ComboField } from "@/components/forms/ComboField";
import { CityField } from "@/components/forms/CityField";
import { US_STATES } from "@/lib/usStates";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";
import { DocUpload } from "@/components/documents/DocUpload";
import { dobYearRange, validateDob, validateSsn } from "@/lib/validation";

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
//   "ssn"  (Married filing separately) — the spouse's NAME + SSN (the 1040's
//   MFS line requires the spouse's full name alongside the SSN).
// onSubmit receives only the fields relevant to the mode, so an MFS save never
// wipes a fuller record.
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

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const range = dobYearRange(new Date().getFullYear());
  const dobErr = mode === "full" ? validateDob(v.date_of_birth, range) : null;
  const ssnErr = validateSsn(v.ssn);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ ssn: true, date_of_birth: true });
    if (ssnErr) return; // spouse SSN must be valid (both modes)
    if (mode === "full" && dobErr) return;
    onSubmit(
      mode === "ssn"
        ? { first_name: v.first_name, last_name: v.last_name, ssn: v.ssn }
        : v,
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* The spouse's name is needed in BOTH modes — the 1040's MFS line
          requires the spouse's full name alongside the SSN. */}
      <Field id="sp_first_name" label="Spouse first name" required maxLength={256} placeholder="e.g. Jane" value={v.first_name} onChange={setText("first_name")} autoComplete="off" />
      <Field id="sp_last_name" label="Spouse last name" required maxLength={256} placeholder="e.g. Doe" value={v.last_name} onChange={setText("last_name")} autoComplete="off" />
      {mode === "full" && (
        <DateField
          id="sp_dob"
          label="Spouse date of birth"
          required
          value={v.date_of_birth}
          onChange={setVal("date_of_birth")}
          onBlur={() => setTouched((t) => ({ ...t, date_of_birth: true }))}
          error={touched.date_of_birth ? dobErr : null}
          hint={v.date_of_birth ? undefined : `Must be between ${range.min} and ${range.max}.`}
        />
      )}

      <SsnField
        id="sp_ssn"
        label="Spouse Social Security number"
        required
        hint="Stored securely on your account."
        value={v.ssn}
        error={touched.ssn ? ssnErr : null}
        onChange={setVal("ssn")}
        onBlur={() => setTouched((t) => ({ ...t, ssn: true }))}
      />

      {mode === "full" && (
        <>
          {/* Verified against the spouse's typed name + SSN; locked until valid. */}
          <DocUpload
            docType="spouse_ssn_copy"
            label="Spouse SSN document"
            expected={
              v.first_name.trim() && v.last_name.trim() && !ssnErr
                ? { name: `${v.first_name} ${v.last_name}`.trim(), ssn: v.ssn }
                : null
            }
            disabledReason={
              v.first_name.trim() && v.last_name.trim() && !ssnErr
                ? null
                : "Enter your spouse's name and Social Security number above first — we verify the card against them."
            }
          />
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
