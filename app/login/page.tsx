"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthShell,
  FormError,
  buttonClass,
  fieldClass,
  labelClass,
} from "@/components/auth/AuthShell";
import { postJson } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, error } = await postJson("/api/auth/signin", { email, password });
    setLoading(false);
    if (!ok) {
      setError(error);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-100">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className={labelClass}>Password</label>
            <Link href="/reset-password" className="text-xs text-zinc-500 underline dark:text-zinc-400">
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />
        </div>
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
