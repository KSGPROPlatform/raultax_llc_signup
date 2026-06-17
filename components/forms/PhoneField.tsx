"use client";

import { fieldClass, labelClass } from "@/components/auth/AuthShell";

// Format up to 10 US digits progressively as `+1 (XXX) XXX-XXXX`.
function formatUsPhone(raw: string): string {
  // Strip our own "+1 " display prefix FIRST so its digit isn't re-counted on
  // every keystroke (that was turning input into a run of 1s). Then drop a
  // pasted leading country-code 1, and keep the 10 national digits.
  let digits = raw.replace(/^\s*\+1\s*/, "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return "";
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  if (digits.length <= 3) return `+1 (${area}`;
  if (digits.length <= 6) return `+1 (${area}) ${prefix}`;
  return `+1 (${area}) ${prefix}-${line}`;
}

// Labelled phone input that formats as you type. The formatted string (incl.
// the +1 country code) is what's stored via onChange — matching the existing
// free-text `phone_number` field.
export function PhoneField({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+1 (555) 123-4567"
        required={required}
        value={value}
        className={fieldClass}
        onChange={(e) => onChange(formatUsPhone(e.target.value))}
      />
    </div>
  );
}
