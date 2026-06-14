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
} from "@/components/auth/AuthShell";
import { postJson } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"email" | "otp" | "password">("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [continuationToken, setContinuationToken] = useState("");
  const [target, setTarget] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{
      continuationToken: string;
      target: string | null;
    }>("/api/auth/reset-password", { step: "start", email });
    setLoading(false);
    if (!ok || !data) return setError(error);
    setContinuationToken(data.continuationToken);
    setTarget(data.target);
    setPhase("otp");
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{ continuationToken: string }>(
      "/api/auth/reset-password",
      { step: "verify", continuationToken, otp },
    );
    setLoading(false);
    if (!ok || !data) return setError(error);
    setContinuationToken(data.continuationToken);
    setPhase("password");
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{ signedIn?: boolean }>(
      "/api/auth/reset-password",
      { step: "complete", continuationToken, newPassword },
    );
    setLoading(false);
    if (!ok) return setError(error);
    router.push(data?.signedIn ? "/dashboard" : "/login");
    router.refresh();
  }

  const back = (
    <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
      Back to sign in
    </Link>
  );

  if (phase === "otp") {
    return (
      <AuthShell
        title="Enter the code"
        subtitle={`We sent a code to ${target ?? "your email"}.`}
        footer={back}
      >
        <form onSubmit={submitOtp} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5">
            <label htmlFor="otp" className={labelClass}>Verification code</label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={`${fieldClass} tracking-[0.3em]`}
            />
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Verifying…" : "Continue"}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (phase === "password") {
    return (
      <AuthShell title="Set a new password" footer={back}>
        <form onSubmit={submitPassword} className="space-y-4">
          <FormError message={error} />
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className={labelClass}>New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-zinc-400">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send a verification code."
      footer={back}
    >
      <form onSubmit={submitEmail} className="space-y-4">
        <FormError message={error} />
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />
        </div>
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending code…" : "Send code"}
        </button>
      </form>
    </AuthShell>
  );
}
