import type { ReactNode } from "react";

// Shared presentational wrapper + control styles for the auth pages.
export const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";

export const buttonClass =
  "w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

export const labelClass =
  "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

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
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
      {message}
    </p>
  );
}
