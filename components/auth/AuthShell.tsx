import type { ReactNode } from "react";

// Shared presentational wrapper + control styles for the auth pages, matched to
// the dashboard's "Trust & Authority" system (amber accent on zinc neutrals).
export const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-amber-500";

export const buttonClass =
  "w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50";

export const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const linkClass =
  "font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-base font-bold text-zinc-950">
            r
          </span>
          <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            raultax
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
          <div className="mt-6">{children}</div>
          {footer && (
            <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {footer}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
          Secured by Microsoft Entra
        </p>
      </div>
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
    >
      {message}
    </p>
  );
}
