"use client";

import { Printer } from "lucide-react";

// Print / save-as-PDF for the filled-return page (browser print dialog).
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 print:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <Printer className="h-4 w-4" /> Print / Download
    </button>
  );
}
