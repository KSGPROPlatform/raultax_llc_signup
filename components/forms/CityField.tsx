"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fieldClass, labelClass } from "@/components/auth/AuthShell";
import { citiesForState } from "@/lib/usCities";

// Labelled text input with a typeahead dropdown of well-known cities for the
// chosen state. Suggestions are filtered by what's typed; clicking or pressing
// Enter on a highlighted suggestion fills the value. Free typing is always
// allowed — the suggestions are a convenience, not a constraint.
export function CityField({
  id,
  label,
  value,
  onChange,
  state,
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  state: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const all = useMemo(() => citiesForState(state), [state]);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q
      ? all.filter((c) => c.toLowerCase().includes(q))
      : all;
    // Hide the dropdown when the only match is an exact echo of the input.
    if (pool.length === 1 && pool[0].toLowerCase() === q) return [];
    return pool.slice(0, 8);
  }, [all, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const showList = open && matches.length > 0;

  function choose(city: string) {
    onChange(city);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (showList && active >= 0 && active < matches.length) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <div ref={wrapRef} className="relative">
        <input
          id={id}
          type="text"
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && active >= 0 ? `${listId}-opt-${active}` : undefined
          }
          className={fieldClass}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {matches.map((city, i) => (
              <li
                key={city}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`cursor-pointer px-3 py-2 ${
                  i === active
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
                // onMouseDown (not onClick) so it fires before the input's blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(city);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {city}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
