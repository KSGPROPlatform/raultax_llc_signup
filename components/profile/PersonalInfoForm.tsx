"use client";

import { useState } from "react";
import { Field, SelectField, FormButtons } from "@/components/forms/Field";
import { CityField } from "@/components/forms/CityField";
import { US_STATES } from "@/lib/usStates";
import { PhoneField } from "@/components/forms/PhoneField";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";
import { DocUpload } from "@/components/documents/DocUpload";
import {
  dobYearRange,
  validateDob,
  validateName,
  validateRequired,
  validateSsn,
  validateZip,
} from "@/lib/validation";

const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed", "Separated"];
const FILING_STATUS = [
  "Single",
  "Married filing jointly",
  "Married filing separately",
  "Head of household",
];
const STATE_NAMES = US_STATES.map((s) => s.name);

export type PersonalInfoValues = {
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  marital_status: string;
  filing_status: string;
  phone_number: string;
  ssn: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
};

const EMPTY: PersonalInfoValues = {
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  marital_status: "",
  filing_status: "",
  phone_number: "",
  ssn: "",
  street_address: "",
  city: "",
  state_province: "",
  postal_code: "",
};

// The full personal-info form (Form 1). Presentational only — it manages its own
// field state and hands the assembled values to `onSubmit`; no fetch/API calls.
// Composes the fancy field components (DOB picker, phone/SSN masking, state +
// city typeahead) over the shared Field/SelectField styling.
export function PersonalInfoForm({
  initial,
  onSubmit,
  busy,
  submitLabel = "Save & continue",
}: {
  initial?: Partial<PersonalInfoValues>;
  onSubmit: (v: PersonalInfoValues) => void;
  busy?: boolean;
  submitLabel?: string;
}): React.JSX.Element {
  const [v, setV] = useState<PersonalInfoValues>({ ...EMPTY, ...initial });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Sliding birth-year window (1940–2016 in 2026, +1 each year).
  const range = dobYearRange(new Date().getFullYear());
  const errs: Record<string, string | null> = {
    first_name: validateName(v.first_name, "First name"),
    last_name: validateName(v.last_name, "Last name"),
    date_of_birth: validateDob(v.date_of_birth, range),
    ssn: validateSsn(v.ssn),
    street_address: validateRequired(v.street_address, "Street address"),
    postal_code: validateZip(v.postal_code),
  };
  const err = (k: string) => (touched[k] ? errs[k] : null);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const setText =
    (k: keyof PersonalInfoValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const setValue = (k: keyof PersonalInfoValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));
  const setSelect =
    (k: keyof PersonalInfoValues) =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      first_name: true,
      last_name: true,
      date_of_birth: true,
      ssn: true,
      street_address: true,
      postal_code: true,
    });
    if (Object.values(errs).some(Boolean)) return; // block on any invalid field
    onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        id="pi_first_name"
        label="First name"
        required
        maxLength={256}
        placeholder="e.g. John"
        value={v.first_name}
        error={err("first_name")}
        onChange={setText("first_name")}
        onBlur={touch("first_name")}
        autoComplete="given-name"
      />
      <Field
        id="pi_middle_name"
        label="Middle name (optional)"
        maxLength={256}
        placeholder="e.g. Michael"
        value={v.middle_name}
        onChange={setText("middle_name")}
        autoComplete="additional-name"
      />
      <Field
        id="pi_last_name"
        label="Last name"
        required
        maxLength={256}
        placeholder="e.g. Doe"
        value={v.last_name}
        error={err("last_name")}
        onChange={setText("last_name")}
        onBlur={touch("last_name")}
        autoComplete="family-name"
      />
      <DateField
        id="pi_dob"
        label="Date of birth"
        required
        value={v.date_of_birth}
        onChange={setValue("date_of_birth")}
        onBlur={touch("date_of_birth")}
        error={err("date_of_birth")}
        hint={v.date_of_birth ? undefined : `Must be between ${range.min} and ${range.max}.`}
      />
      <SelectField
        id="pi_marital_status"
        label="Marital status"
        required
        value={v.marital_status}
        onChange={setSelect("marital_status")}
        options={MARITAL_STATUS}
      />
      <SelectField
        id="pi_filing_status"
        label="Filing status"
        required
        value={v.filing_status}
        onChange={setSelect("filing_status")}
        options={FILING_STATUS}
      />
      <PhoneField
        id="pi_phone_number"
        label="Phone number"
        required
        value={v.phone_number}
        onChange={setValue("phone_number")}
      />
      <SsnField
        id="pi_ssn"
        label="Social Security number"
        required
        hint="Stored securely on your account."
        value={v.ssn}
        error={err("ssn")}
        onChange={setValue("ssn")}
        onBlur={touch("ssn")}
      />
      {/* The SSN card is verified against the typed name + SSN, so the slot
          unlocks only once those are valid. */}
      <DocUpload
        docType="ssn_copy"
        label="SSN document"
        expected={
          !errs.first_name && !errs.last_name && !errs.ssn
            ? { name: `${v.first_name} ${v.last_name}`.trim(), ssn: v.ssn }
            : null
        }
        disabledReason={
          !errs.first_name && !errs.last_name && !errs.ssn
            ? null
            : "Enter your name and Social Security number above first — we verify the card against them."
        }
      />
      <Field
        id="pi_street_address"
        label="Street address"
        required
        maxLength={256}
        placeholder="e.g. 123 Main St"
        value={v.street_address}
        error={err("street_address")}
        onChange={setText("street_address")}
        onBlur={touch("street_address")}
        autoComplete="street-address"
      />
      <SelectField
        id="pi_state_province"
        label="State"
        required
        value={v.state_province}
        onChange={setSelect("state_province")}
        options={STATE_NAMES}
      />
      <CityField
        id="pi_city"
        label="City"
        required
        placeholder="e.g. New York"
        value={v.city}
        onChange={setValue("city")}
        state={v.state_province}
      />
      <Field
        id="pi_postal_code"
        label="Postal code"
        required
        maxLength={16}
        inputMode="numeric"
        placeholder="e.g. 10001"
        value={v.postal_code}
        error={err("postal_code")}
        onChange={setText("postal_code")}
        onBlur={touch("postal_code")}
        autoComplete="postal-code"
      />
      <FormButtons busy={busy} submitLabel={submitLabel} />
    </form>
  );
}
