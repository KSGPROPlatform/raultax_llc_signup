"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthShell,
  FormError,
  buttonClass,
  fieldClass,
  linkClass,
} from "@/components/auth/AuthShell";
import { Field as Text } from "@/components/forms/Field";
import { postJson } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "otp">("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Start native sign-up (email + password) -> Entra sends an OTP email.
  async function startSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError("Email is required.");
    if (password.length < 8)
      return setError("Password must be at least 8 characters.");
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{
      continuationToken: string;
      target: string | null;
    }>("/api/auth/signup", { step: "start", email, password });
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
      <form onSubmit={startSignup} className="space-y-4">
        <FormError message={error} />
        <Text
          id="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Text
          id="password"
          label="Password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending code…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
