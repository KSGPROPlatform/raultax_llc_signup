"use client";

import { useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";

export type BankValues = {
  bank_name: string;
  account_number: string;
  routing_number: string;
};

const EMPTY: BankValues = {
  bank_name: "",
  account_number: "",
  routing_number: "",
};

// One bank account (Form 3). Shared by onboarding + dashboard.
export function BankForm({
  initial,
  onSubmit,
  onCancel,
  busy,
  submitLabel = "Save account",
}: {
  initial?: Partial<BankValues>;
  onSubmit: (v: BankValues) => void;
  onCancel?: () => void;
  busy?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<BankValues>({ ...EMPTY, ...initial });
  const set =
    (k: keyof BankValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <Field id="bank_name" label="Bank name" required maxLength={128} value={v.bank_name} onChange={set("bank_name")} autoComplete="off" />
      <Field id="bank_account" label="Account number" required maxLength={64} value={v.account_number} onChange={set("account_number")} autoComplete="off" inputMode="numeric" hint="Stored securely on your account." />
      <Field id="bank_routing" label="Routing number" required maxLength={32} value={v.routing_number} onChange={set("routing_number")} autoComplete="off" inputMode="numeric" />
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
