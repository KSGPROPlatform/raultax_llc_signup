"use client";

import { useEffect, useState } from "react";
import { Field, FormButtons } from "@/components/forms/Field";
import { MaskedField } from "@/components/forms/MaskedField";

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
  const setVal = (k: keyof BankValues) => (value: string) =>
    setV((p) => ({ ...p, [k]: value }));

  // Auto-fill the bank name from a valid 9-digit routing number (free lookup,
  // proxied by our server). Clears the hint as the user edits, then fills the
  // name only when it's empty so manual edits are never clobbered.
  const [bankHint, setBankHint] = useState<string | null>(null);
  const onRouting = (value: string) => {
    setV((p) => ({ ...p, routing_number: value }));
    setBankHint(null);
  };
  useEffect(() => {
    const digits = v.routing_number.replace(/\D/g, "");
    if (digits.length !== 9) return;
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bank-lookup?routing=${digits}`);
        const data = (await res.json().catch(() => ({}))) as { bankName?: string | null };
        if (!active) return;
        if (data.bankName) {
          const name = data.bankName;
          setBankHint(`✓ ${name}`);
          setV((p) => (p.bank_name.trim() ? p : { ...p, bank_name: name }));
        } else {
          setBankHint("Couldn't identify the bank — enter it manually.");
        }
      } catch {
        if (active) setBankHint(null);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [v.routing_number]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-4"
    >
      <MaskedField id="bank_routing" label="Routing number" required maxLength={32} inputMode="numeric" value={v.routing_number} onChange={onRouting} hint={bankHint ?? undefined} />
      <Field id="bank_name" label="Bank name" required maxLength={128} value={v.bank_name} onChange={set("bank_name")} autoComplete="off" />
      <MaskedField id="bank_account" label="Account number" required maxLength={64} inputMode="numeric" value={v.account_number} onChange={setVal("account_number")} hint="Stored securely on your account." />
      <FormButtons busy={busy} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
