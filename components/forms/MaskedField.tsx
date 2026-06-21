"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { fieldClass, labelClass } from "@/components/auth/AuthShell";

// A labelled input that's masked by default with an eye toggle to reveal — the
// same privacy treatment as the SSN field on Form 1, for other sensitive
// numbers (bank account/routing, EIN). Unlike SsnField it applies no specific
// formatting, so it suits any value.
export function MaskedField({
  id,
  label,
  value,
  onChange,
  required,
  hint,
  maxLength,
  inputMode,
  placeholder,
  autoComplete = "off",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  maxLength?: number;
  inputMode?: "numeric" | "text" | "tel";
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

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
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          value={value}
          className={`${fieldClass} pr-11`}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus-visible:text-amber-500 dark:hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
