"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, buttonClass, linkClass } from "@/components/auth/AuthShell";
import { Field } from "@/components/forms/Field";
import { PasswordField } from "@/components/forms/PasswordField";
import { validateEmail } from "@/lib/validation";
import { postJson } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailErr = touched.email ? validateEmail(email) : null;
  const passwordErr = touched.password && !password ? "Password is required." : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (validateEmail(email) || !password) return; // inline errors show
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
          <Link href="/signup" className={linkClass}>
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={emailErr}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          error={passwordErr}
          forgotHref="/reset-password"
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
        />
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
