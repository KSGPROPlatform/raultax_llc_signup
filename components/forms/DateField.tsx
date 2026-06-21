"use client";

import { fieldClass, labelClass } from "@/components/auth/AuthShell";

// Auto-formatting date input (US MM/DD/YYYY). Digits only; slashes are inserted
// progressively as you type, so the value always matches the placeholder
// pattern. Simpler and clearer than a calendar popover for a birth date.
function formatDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  const mm = d.slice(0, 2);
  const dd = d.slice(2, 4);
  const yyyy = d.slice(4, 8);
  if (d.length <= 2) return mm;
  if (d.length <= 4) return `${mm}/${dd}`;
  return `${mm}/${dd}/${yyyy}`;
}

export function DateField({
  id,
  label,
  value,
  onChange,
  required,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="MM/DD/YYYY"
        maxLength={10}
        required={required}
        value={value}
        className={fieldClass}
        onChange={(e) => onChange(formatDate(e.target.value))}
      />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
