import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Fingerprint, Users, CalendarRange, FileText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminUserDetail, getReviewerQueue } from "@/lib/admin";
import { TaxReturnReview } from "@/components/dashboard/TaxReturnReview";
import { maskTail } from "@/components/profile/mask";

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return "?";
}

// One assigned client: a proper client header + the full review panel
// (recompute, per-line overrides, approve & freeze) — assignment-scoped.
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ oid: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "reviewer" && user.role !== "admin") redirect("/dashboard/user");

  const { oid } = await params;
  const queue = await getReviewerQueue(user.sub);
  const mine = queue.filter((r) => r.owner_oid === oid);
  if (mine.length === 0) redirect("/dashboard/review");

  const detail = await getAdminUserDetail(oid);
  const u = detail?.user;
  const fullName = u
    ? [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || u.name || "—"
    : "—";

  const facts = [
    { icon: Mail, label: "Email", value: u?.email || "—" },
    { icon: Fingerprint, label: "SSN", value: maskTail(u?.ssn ?? "") },
    { icon: Users, label: "Filing status", value: u?.filing_status || "—" },
    { icon: CalendarRange, label: "Assigned years", value: mine.map((r) => r.tax_year).join(", ") },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/review"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to my queue
      </Link>

      {/* Client header */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div
          aria-hidden
          className="h-16 bg-gradient-to-r from-amber-500/15 via-amber-400/5 to-transparent"
        />
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-8 flex flex-wrap items-end gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-lg font-bold text-zinc-950 shadow-md ring-4 ring-white dark:ring-zinc-950">
              {initialsOf(fullName)}
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Client
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {fullName}
              </h1>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-zinc-900/60"
              >
                <f.icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {f.label}
                  </dt>
                  <dd className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {f.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Review panel */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Tax return (Form 1040)
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Recompute, override any line, then Approve &amp; freeze to release the numbers.
            </p>
          </div>
        </div>
        <TaxReturnReview oid={oid} apiBase="/api/review" />
      </section>
    </div>
  );
}
