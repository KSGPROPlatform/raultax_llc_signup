import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, CheckCircle2, Clock, ArrowRight, Inbox } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/admin";

// The reviewer's home: ONLY the declarations the admin assigned to them,
// pending ones first. Clicking a row opens the review panel for that client.
export default async function ReviewQueuePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "reviewer" && user.role !== "admin") redirect("/dashboard/user");

  const rows = await getReviewerQueue(user.sub);
  const pending = rows.filter((r) => r.status === "submitted" && !r.frozen).length;
  const approved = rows.filter((r) => Boolean(r.frozen)).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Review queue
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Declarations assigned to you — review the numbers, adjust if needed, then approve.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3" aria-label="Overview">
        {[
          { label: "Assigned to me", value: rows.length, icon: ClipboardList },
          { label: "Awaiting review", value: pending, icon: Clock },
          { label: "Approved", value: approved, icon: CheckCircle2 },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">{k.value}</p>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assigned declarations</h2>
        {rows.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nothing assigned to you yet — the admin hands declarations to reviewers.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={`${r.owner_oid}-${r.tax_year}`}>
                <Link
                  href={`/dashboard/review/${r.owner_oid}?year=${r.tax_year}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50/40 dark:border-zinc-800 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {r.user_name || r.user_email || "—"}
                      <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        Tax year {r.tax_year}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {r.user_email || ""}{r.filing_status ? ` · ${r.filing_status}` : ""}
                    </p>
                  </div>
                  {r.frozen ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  ) : r.status === "submitted" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Awaiting review
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      Draft
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
