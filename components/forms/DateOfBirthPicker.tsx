"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { fieldClass, labelClass } from "@/components/auth/AuthShell";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (y: number, m: number, d: number) => `${pad(m + 1)}/${pad(d)}/${y}`;

// Parse an MM/DD/YYYY string back into parts; undefined if it isn't a real date.
function parseValue(v: string): { y: number; m: number; d: number } | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!match) return undefined;
  const mm = Number(match[1]);
  const dd = Number(match[2]);
  const yyyy = Number(match[3]);
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    return undefined;
  }
  return { y: yyyy, m: mm - 1, d: dd };
}

// A no-dependency calendar DOB picker. The trigger shows the selected MM/DD/YYYY
// and opens a popover with month arrows + a year dropdown so a birth year decades
// in the past is one click away. Amber accents on zinc neutrals, dark-mode aware.
export function DateOfBirthPicker({
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => parseValue(value), [value]);

  const now = new Date();
  const thisYear = now.getFullYear();
  // The month currently shown in the grid (defaults to the selection, else ~30y ago).
  const [view, setView] = useState(() => ({
    y: selected?.y ?? thisYear - 30,
    m: selected?.m ?? now.getMonth(),
  }));

  function toggleOpen() {
    setOpen((o) => {
      // When opening, re-centre the grid on the current selection.
      if (!o && selected) setView({ y: selected.y, m: selected.m });
      return !o;
    });
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Year range: from 120 years ago up to the current year (newest first).
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = thisYear; y >= thisYear - 120; y--) out.push(y);
    return out;
  }, [thisYear]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function pick(day: number) {
    onChange(toValue(view.y, view.m, day));
    setOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-amber-500"> *</span>}
      </label>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          id={id}
          onClick={toggleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`${fieldClass} flex cursor-pointer items-center justify-between text-left`}
        >
          <span className={value ? "" : "text-zinc-400 dark:text-zinc-500"}>
            {value || "MM/DD/YYYY"}
          </span>
          <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        {/* A hidden input carries `required` so native form validation still works. */}
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            required
            value={value}
            onChange={() => {}}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
          />
        )}

        {open && (
          <div
            role="dialog"
            aria-label="Choose date of birth"
            className="absolute z-30 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* Month + year navigation */}
            <div className="mb-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                aria-label="Month"
                value={view.m}
                onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
                className="flex-1 cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {MONTHS.map((mo, i) => (
                  <option key={mo} value={i}>
                    {mo}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={view.y}
                onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
                className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-medium text-zinc-400">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const isSelected =
                  selected?.y === view.y &&
                  selected?.m === view.m &&
                  selected?.d === day;
                const isToday =
                  thisYear === view.y &&
                  now.getMonth() === view.m &&
                  now.getDate() === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    aria-label={`${MONTHS[view.m]} ${day}, ${view.y}`}
                    aria-pressed={isSelected}
                    className={`grid h-8 w-8 place-items-center rounded-md text-sm transition-colors ${
                      isSelected
                        ? "bg-amber-500 font-semibold text-zinc-950"
                        : isToday
                          ? "font-semibold text-amber-600 hover:bg-zinc-100 dark:text-amber-400 dark:hover:bg-zinc-800"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
