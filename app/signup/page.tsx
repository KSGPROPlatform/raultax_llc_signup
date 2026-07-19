"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthShell,
  FormError,
  buttonClass,
  fieldClass,
  linkClass,
} from "@/components/auth/AuthShell";
import { Field } from "@/components/forms/Field";
import { PasswordField } from "@/components/forms/PasswordField";
import { validateEmail, validateName, validatePassword } from "@/lib/validation";
import { postJson } from "@/lib/api";

// useSearchParams needs a Suspense boundary during prerender.
export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const invite = (search.get("invite") ?? "").trim();
  const [step, setStep] = useState<"account" | "otp">("account");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(invite);
  const [password, setPassword] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errs = {
    first: validateName(firstName, "First name"),
    last: validateName(lastName, "Last name"),
    email: validateEmail(email),
    password: validatePassword(password),
  };
  const formValid = !errs.first && !errs.last && !errs.email && !errs.password;

  // Start native sign-up (email + password) -> Entra sends an OTP email.
  async function startSignup(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ first_name: true, last_name: true, email: true, password: true });
    if (!formValid) return; // inline errors + the strength meter guide the user
    setError(null);
    setLoading(true);
    // first + last become the Entra display name (and our stored name).
    const displayName = `${firstName} ${lastName}`.trim();
    const { ok, data, error } = await postJson<{
      continuationToken: string;
      target: string | null;
    }>("/api/auth/signup", { step: "start", email, password, displayName });
    setLoading(false);
    if (!ok || !data) return setError(error);
    setContinuationToken(data.continuationToken);
    setTarget(data.target);
    setStep("otp");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, error } = await postJson("/api/auth/signup", {
      step: "verify",
      continuationToken,
      otp,
      password,
      first_name: firstName,
      last_name: lastName,
      name: `${firstName} ${lastName}`.trim(),
    });
    setLoading(false);
    if (!ok) return setError(error);
    // Account is created — go straight to the dashboard. Personal info and the
    // rest of onboarding are collected later from the dashboard nudge.
    router.push("/dashboard");
    router.refresh();
  }

  // ---- OTP step ----
  if (step === "otp") {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={`Enter the code we sent to ${target ?? "your email"}.`}
      >
        <form onSubmit={verify} className="space-y-4">
          {invite && (
            <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              You&apos;ve been invited to join <span className="font-semibold">raultax</span> as a
              reviewer — create your account with this email to get started.
            </p>
          )}
          <FormError message={error} />
          <Field
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
              setStep("account");
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

  // ---- Account step (email + password) ----
  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up with your email and a password."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={startSignup} className="space-y-4" noValidate>
        {invite && (
            <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
              You&apos;ve been invited to join <span className="font-semibold">raultax</span> as a
              reviewer — create your account with this email to get started.
            </p>
          )}
          <FormError message={error} />
        <Field
          id="first_name"
          label="First name"
          required
          autoComplete="given-name"
          value={firstName}
          error={touched.first_name ? errs.first : null}
          onChange={(e) => setFirstName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, first_name: true }))}
        />
        <Field
          id="last_name"
          label="Last name"
          required
          autoComplete="family-name"
          value={lastName}
          error={touched.last_name ? errs.last : null}
          onChange={(e) => setLastName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, last_name: true }))}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          error={touched.email ? errs.email : null}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <PasswordField
          id="password"
          label="Password"
          required
          autoComplete="new-password"
          value={password}
          error={touched.password ? errs.password : null}
          showStrength
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        />
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending code…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
