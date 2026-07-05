"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fieldClass, labelClass } from "@/components/auth/AuthShell";

// Format up to 9 digits as `XXX-XX-XXXX`.
function formatSsn(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 5);
  const c = digits.slice(5, 9);
  if (digits.length <= 3) return a;
  if (digits.length <= 5) return `${a}-${b}`;
  return `${a}-${b}-${c}`;
}

// Labelled SSN input, masked by default with an eye toggle to reveal. Formats
// as `XXX-XX-XXXX` while typing. The formatted string is stored via onChange,
// matching the existing free-text `ssn` field ("Stored securely on your account").
export function SsnField({
  id,
  label,
  value,
  onChange,
  onBlur,
  required,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  hint?: string;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  const cls = `${fieldClass} pr-11 ${
    error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60" : ""
  }`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          placeholder="123-45-6789"
          maxLength={11}
          required={required}
          value={value}
          aria-invalid={Boolean(error)}
          className={cls}
          onChange={(e) => onChange(formatSsn(e.target.value))}
          onBlur={onBlur}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide SSN" : "Show SSN"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus-visible:text-amber-500 dark:hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
