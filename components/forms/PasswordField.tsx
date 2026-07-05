"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { fieldClass, labelClass } from "@/components/auth/AuthShell";
import { passwordChecks, passwordStrength } from "@/lib/validation";

// Password input with a show/hide eye toggle (same treatment as the SSN field),
// an optional live strength meter + requirements checklist, an inline error, and
// an optional "Forgot?" link. Used on login, sign-up and reset-password.
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete = "current-password",
  required,
  error,
  forgotHref,
  showStrength = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  required?: boolean;
  error?: string | null;
  forgotHref?: string;
  showStrength?: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const cls = `${fieldClass} pr-11 ${
    error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60" : ""
  }`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClass}>
          {label}
          {required && <span className="text-amber-500"> *</span>}
        </label>
        {forgotHref && (
          <Link
            href={forgotHref}
            className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            Forgot?
          </Link>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cls}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus-visible:text-amber-500 dark:hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {showStrength && value.length > 0 && <PasswordStrengthMeter pw={value} />}
    </div>
  );
}

function PasswordStrengthMeter({ pw }: { pw: string }) {
  const c = passwordChecks(pw);
  const { score, label } = passwordStrength(pw);
  const barColor = ["bg-zinc-300", "bg-red-500", "bg-amber-500", "bg-yellow-500", "bg-emerald-500"][score];
  const rules = [
    { ok: c.length, text: "8–64 characters" },
    { ok: c.upper, text: "Uppercase letter" },
    { ok: c.lower, text: "Lowercase letter" },
    { ok: c.number, text: "Number" },
    { ok: c.special, text: "Symbol (recommended)" },
  ];

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-full flex-1 rounded-full transition-colors ${
                i <= score ? barColor : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>
        <span className="w-14 shrink-0 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map((r) => (
          <li
            key={r.text}
            className={`flex items-center gap-1.5 text-xs ${
              r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {r.ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
