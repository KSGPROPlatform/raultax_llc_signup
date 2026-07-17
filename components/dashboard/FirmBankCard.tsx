import { Landmark } from "lucide-react";
import { FIRM_BANK, FEE_LABEL } from "@/lib/firm";

// The firm's OWN bank details — always listed first under Banking, so every
// client sees where the preparation fee goes before their personal accounts.
// Shown in full (clients need the numbers to make the payment).
export function FirmBankCard() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <Landmark className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Our bank details
            <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              raultax
            </span>
          </p>
          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
            We charge <span className="font-semibold">{FEE_LABEL} per declaration</span> (per tax
            year), payable to this account.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-zinc-500 dark:text-zinc-400">Account name</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{FIRM_BANK.accountName}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-zinc-500 dark:text-zinc-400">Bank</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{FIRM_BANK.bankName}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-zinc-500 dark:text-zinc-400">Routing number</dt>
              <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{FIRM_BANK.routingNumber}</dd>
            </div>
            <div className="flex justify-between gap-2 sm:block">
              <dt className="text-zinc-500 dark:text-zinc-400">Account number</dt>
              <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{FIRM_BANK.accountNumber}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
