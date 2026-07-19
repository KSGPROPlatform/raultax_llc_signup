import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  ChevronRight,
  Inbox,
  Sparkles,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/admin";

// First letters of the first two words — "Bonnie Hernandez" -> "BH".
function initialsOf(name: string | null, email: string | null): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email || "?").charAt(0).toUpperCase();
}

// The reviewer's home: a warm hero, sharp stats, and a polished queue of ONLY
// the declarations the admin assigned to them — pending work always on top.
export default async function ReviewQueuePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "reviewer" && user.role !== "admin") redirect("/dashboard/user");

  const rows = await getReviewerQueue(user.sub);
  const pending = rows.filter((r) => r.status === "submitted" && !r.frozen);
  const approved = rows.filter((r) => Boolean(r.frozen));
  const firstName = (user.name || "").split(" ")[0] || "there";

  const stats = [
    { label: "Assigned to me", value: rows.length, icon: ClipboardList, tone: "text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800" },
    { label: "Awaiting review", value: pending.length, icon: Clock, tone: "text-amber-700 bg-amber-500/15 dark:text-amber-400" },
    { label: "Approved", value: approved.length, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-500/15 dark:text-emerald-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white p-6 sm:p-8 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-zinc-950 dark:to-zinc-950">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/10 blur-2xl"
        />
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
          Review workspace
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          {pending.length > 0 ? (
            <>
              You have{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {pending.length} declaration{pending.length > 1 ? "s" : ""}
              </span>{" "}
              waiting for your review — check the numbers, adjust where needed,
              then approve.
            </>
          ) : (
            "Nothing is waiting on you right now. New assignments from the admin will appear here."
          )}
        </p>

        {/* Stats inside the hero for one strong opening block */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
                  {s.value}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Queue */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Assigned declarations
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Open one to review the computed Form 1040 line by line.
            </p>
          </div>
          {rows.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {rows.length}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Inbox className="h-7 w-7" />
            </span>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Your queue is empty
            </p>
            <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              The admin assigns submitted declarations to reviewers — as soon as
              one lands on you, it shows up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={`${r.owner_oid}-${r.tax_year}`}>
                <Link
                  href={`/dashboard/review/${r.owner_oid}?year=${r.tax_year}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-px hover:border-amber-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-amber-500/40"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400/30 to-amber-500/10 text-sm font-bold text-amber-800 dark:text-amber-300">
                    {initialsOf(r.user_name, r.user_email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className="truncate">{r.user_name || r.user_email || "—"}</span>
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        {r.tax_year}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {r.user_email || ""}
                      {r.filing_status ? ` · ${r.filing_status}` : ""}
                    </p>
                  </div>

                  {r.frozen ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  ) : r.status === "submitted" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5" /> Awaiting review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5" /> Draft — client editing
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
