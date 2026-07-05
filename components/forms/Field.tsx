import { buttonClass, fieldClass, labelClass } from "@/components/auth/AuthShell";

// Shared labelled form controls (extracted from the sign-up wizard) so the
// sign-up flow, the onboarding stepper, and the dashboard sections all render
// identical inputs. Presentational only — no state.

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
}) {
  const base = className ?? fieldClass;
  const cls = error
    ? `${base} border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60`
    : base;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <input id={id} required={required} aria-invalid={Boolean(error)} className={cls} {...props} />
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  options,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className={`${fieldClass} cursor-pointer`}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Cancel/submit row shared by the entity forms (modal + onboarding).
export function FormButtons({
  busy,
  submitLabel = "Save",
  onCancel,
}: {
  busy?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      )}
      <button type="submit" disabled={busy} className={`${buttonClass} flex-1`}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}
