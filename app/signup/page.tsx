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

export default function SignupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"details" | "otp">("details");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [continuationToken, setContinuationToken] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data, error } = await postJson<{
      continuationToken: string;
      target: string | null;
    }>("/api/auth/signup", { step: "start", email, password, name });
    setLoading(false);
    if (!ok || !data) {
      setError(error);
      return;
    }
    setContinuationToken(data.continuationToken);
    setTarget(data.target);
    setPhase("otp");
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, error } = await postJson("/api/auth/signup", {
      step: "verify",
      continuationToken,
      otp,
      password,
      name,
    });
    setLoading(false);
    if (!ok) {
      setError(error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (phase === "otp") {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={`We sent a code to ${target ?? "your email"}. Enter it below.`}
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
            {loading ? "Verifying…" : "Verify & create account"}
          </button>
          <button
            type="button"
            onClick={() => { setPhase("details"); setError(null); }}
            className="w-full text-center text-sm text-zinc-500 underline dark:text-zinc-400"
          >
            Back
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Microsoft secures your identity; the experience stays here."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submitDetails} className="space-y-4">
        <FormError message={error} />
        <div className="space-y-1.5">
          <label htmlFor="name" className={labelClass}>Full name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </div>
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
        <div className="space-y-1.5">
          <label htmlFor="password" className={labelClass}>Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
          <p className="text-xs text-zinc-400">At least 8 characters.</p>
        </div>
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Sending code…" : "Continue"}
        </button>
      </form>
    </AuthShell>
  );
}
