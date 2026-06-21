"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { ComboField } from "@/components/forms/ComboField";
import { CityField } from "@/components/forms/CityField";
import { US_STATES } from "@/lib/usStates";
import { PhoneField } from "@/components/forms/PhoneField";
import { SsnField } from "@/components/forms/SsnField";
import { DateField } from "@/components/forms/DateField";
import { DocUpload } from "@/components/documents/DocUpload";

const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed", "Separated"];
const FILING_STATUS = [
  "Single",
  "Married filing jointly",
  "Married filing separately",
  "Head of household",
  "Qualifying surviving spouse",
];
const STATE_NAMES = US_STATES.map((s) => s.name);

export type PersonalInfoValues = {
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  marital_status: string;
  filing_status: string;
  job_title: string;
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
  job_title: "",
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

  const setText =
    (k: keyof PersonalInfoValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));
  const setValue = (k: keyof PersonalInfoValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field
        id="pi_first_name"
        label="First name"
        required
        maxLength={256}
        value={v.first_name}
        onChange={setText("first_name")}
        autoComplete="given-name"
      />
      <Field
        id="pi_middle_name"
        label="Middle name (optional)"
        maxLength={256}
        value={v.middle_name}
        onChange={setText("middle_name")}
        autoComplete="additional-name"
      />
      <Field
        id="pi_last_name"
        label="Last name"
        required
        maxLength={256}
        value={v.last_name}
        onChange={setText("last_name")}
        autoComplete="family-name"
      />
      <DateField
        id="pi_dob"
        label="Date of birth"
        required
        value={v.date_of_birth}
        onChange={setValue("date_of_birth")}
      />
      <ComboField
        id="pi_marital_status"
        label="Marital status"
        required
        value={v.marital_status}
        onChange={setValue("marital_status")}
        options={MARITAL_STATUS}
      />
      <ComboField
        id="pi_filing_status"
        label="Filing status"
        required
        value={v.filing_status}
        onChange={setValue("filing_status")}
        options={FILING_STATUS}
      />
      <Field
        id="pi_job_title"
        label="Job title"
        required
        maxLength={256}
        value={v.job_title}
        onChange={setText("job_title")}
        autoComplete="organization-title"
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
        onChange={setValue("ssn")}
      />
      <DocUpload docType="ssn_copy" label="SSN document" />
      <Field
        id="pi_street_address"
        label="Street address"
        required
        maxLength={256}
        value={v.street_address}
        onChange={setText("street_address")}
        autoComplete="street-address"
      />
      <ComboField
        id="pi_state_province"
        label="State"
        required
        value={v.state_province}
        onChange={setValue("state_province")}
        options={STATE_NAMES}
      />
      <CityField
        id="pi_city"
        label="City"
        required
        value={v.city}
        onChange={setValue("city")}
        state={v.state_province}
      />
      <Field
        id="pi_postal_code"
        label="Postal code"
        required
        maxLength={16}
        value={v.postal_code}
        onChange={setText("postal_code")}
        autoComplete="postal-code"
      />
      <FormButtons busy={busy} submitLabel={submitLabel} />
    </form>
  );
}
