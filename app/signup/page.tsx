"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthShell,
  FormError,
  buttonClass,
  fieldClass,
  labelClass,
  linkClass,
} from "@/components/auth/AuthShell";
import { postJson } from "@/lib/api";

const FILING_STATUS = [
  "Single",
  "Married filing jointly",
  "Married filing separately",
  "Head of household",
  "Qualifying surviving spouse",
];
const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed", "Separated"];

type Form = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  date_of_birth: string;
  marital_status: string;
  job_title: string;
  phone_number: string;
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  filing_status: string;
  ssn: string;
};

const EMPTY: Form = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  middle_name: "",
  date_of_birth: "",
  marital_status: "",
  job_title: "",
  phone_number: "",
  street_address: "",
  city: "",
  state_province: "",
  postal_code: "",
  filing_status: "",
  ssn: "",
};

const STEP_TITLES = ["Account", "Your details", "Address", "Tax details"];
const TOTAL_STEPS = STEP_TITLES.length;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..3 collect, 4 = OTP
  const [form, setForm] = useState<Form>(EMPTY);
  const [continuationToken, setContinuationToken] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set =
    (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate(): string | null {
    if (step === 0) {
      if (!form.email) return "Email is required.";
      if (form.password.length < 8)
        return "Password must be at least 8 characters.";
    }
    if (step === 1 && !form.first_name.trim()) return "First name is required.";
    return null;
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setStep((s) => s + 1);
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  // Last detail step submits: start native sign-up (email+password) -> send OTP.
  async function startSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{
      continuationToken: string;
      target: string | null;
    }>("/api/auth/signup", {
      step: "start",
      email: form.email,
      password: form.password,
      displayName: `${form.first_name} ${form.last_name}`.trim(),
    });
    setLoading(false);
    if (!ok || !data) return setError(error);
    setContinuationToken(data.continuationToken);
    setTarget(data.target);
    setStep(4);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const name = [form.first_name, form.middle_name, form.last_name]
      .filter(Boolean)
      .join(" ");
    const profile = {
      first_name: form.first_name,
      last_name: form.last_name,
      middle_name: form.middle_name,
      date_of_birth: form.date_of_birth,
      filing_status: form.filing_status,
      marital_status: form.marital_status,
      job_title: form.job_title,
      phone_number: form.phone_number,
      ssn: form.ssn,
      street_address: form.street_address,
      city: form.city,
      state_province: form.state_province,
      postal_code: form.postal_code,
    };
    const { ok, error } = await postJson("/api/auth/signup", {
      step: "verify",
      continuationToken,
      otp,
      password: form.password,
      name,
      profile,
    });
    setLoading(false);
    if (!ok) return setError(error);
    router.push("/dashboard");
    router.refresh();
  }

  // ---- OTP step ----
  if (step === 4) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={`Enter the code we sent to ${target ?? "your email"}.`}
      >
        <form onSubmit={verify} className="space-y-4">
          <FormError message={error} />
          <Text
            id="otp"
            label="Verification code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className={`${fieldClass} tracking-[0.3em]`}
          />
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Verifying…" : "Verify & create account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(3);
              setError(null);
            }}
            className="w-full text-center text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Back
          </button>
        </form>
      </AuthShell>
    );
  }

  const onSubmit = step === 3 ? startSignup : next;

  return (
    <AuthShell
      title="Create your account"
      subtitle={`Step ${step + 1} of ${TOTAL_STEPS} · ${STEP_TITLES[step]}`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      {/* Progress */}
      <div className="mb-5 flex gap-1.5">
        {STEP_TITLES.map((t, i) => (
          <span
            key={t}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />

        {step === 0 && (
          <>
            <Text id="email" label="Email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
            <Text id="password" label="Password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} hint="At least 8 characters." />
          </>
        )}

        {step === 1 && (
          <>
            <Text id="first_name" label="First name" required value={form.first_name} onChange={set("first_name")} autoComplete="given-name" />
            <Text id="last_name" label="Last name" required value={form.last_name} onChange={set("last_name")} autoComplete="family-name" />
            <Text id="middle_name" label="Middle name (optional)" value={form.middle_name} onChange={set("middle_name")} autoComplete="additional-name" />
            <Text id="date_of_birth" label="Date of birth" placeholder="DD/MM/YY" required value={form.date_of_birth} onChange={set("date_of_birth")} autoComplete="bday" />
            <Select id="marital_status" label="Marital status" required value={form.marital_status} onChange={set("marital_status")} options={MARITAL_STATUS} />
            <Text id="job_title" label="Job title" required value={form.job_title} onChange={set("job_title")} autoComplete="organization-title" />
            <Text id="phone_number" label="Phone number" type="tel" required value={form.phone_number} onChange={set("phone_number")} autoComplete="tel" />
          </>
        )}

        {step === 2 && (
          <>
            <Text id="street_address" label="Street address" required value={form.street_address} onChange={set("street_address")} autoComplete="street-address" />
            <Text id="city" label="City" required value={form.city} onChange={set("city")} autoComplete="address-level2" />
            <Text id="state_province" label="State / Province" required value={form.state_province} onChange={set("state_province")} autoComplete="address-level1" />
            <Text id="postal_code" label="Postal code" required value={form.postal_code} onChange={set("postal_code")} autoComplete="postal-code" />
          </>
        )}

        {step === 3 && (
          <>
            <Select id="filing_status" label="Filing status" required value={form.filing_status} onChange={set("filing_status")} options={FILING_STATUS} />
            <Text id="ssn" label="Social Security number" required value={form.ssn} onChange={set("ssn")} hint="Stored securely on your account." autoComplete="off" />
          </>
        )}

        <div className="flex gap-2 pt-1">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Back
            </button>
          )}
          <button type="submit" disabled={loading} className={`${buttonClass} flex-1`}>
            {step === 3 ? (loading ? "Sending code…" : "Create account") : "Continue"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

function Text({
  id,
  label,
  hint,
  required,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <input id={id} required={required} className={className ?? fieldClass} {...props} />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function Select({
  id,
  label,
  options,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className={`${fieldClass} cursor-pointer`}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
