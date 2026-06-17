import { fieldClass, labelClass } from "@/components/auth/AuthShell";
import { US_STATES } from "@/lib/usStates";

// Labelled <select> of the 50 states + DC. Value is the state's FULL NAME, to
// match the existing free-text `state_province` field the API stores. Mirrors
// SelectField's markup (label + required marker + "Select…" placeholder).
export function StateSelect({
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
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete="address-level1"
        className={`${fieldClass} cursor-pointer`}
      >
        <option value="">Select…</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
