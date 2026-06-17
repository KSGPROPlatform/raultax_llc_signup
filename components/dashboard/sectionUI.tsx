"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// Shared chrome for the dashboard/onboarding list sections (dependents, bank,
// companies) so they all render consistently.

export function SectionError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
    >
      {message}
    </p>
  );
}

export function SectionSkeleton() {
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      {text}
    </p>
  );
}

export function ListContainer({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
      {children}
    </div>
  );
}

export function ListRow({
  icon: Icon,
  title,
  subtitle,
  onEdit,
  onDelete,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {title}
        </div>
        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit"
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}
