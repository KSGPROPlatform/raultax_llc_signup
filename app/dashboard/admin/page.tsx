import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  UserCog,
  ClipboardList,
  CheckCircle2,
  FolderOpen,
  UserPlus,
  Building2,
  Clock,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminOverview, getQueue } from "@/lib/admin";

// The admin OVERVIEW is deliberately simple: a warm hero that says what needs
// attention, the KPIs, and shortcuts into the dedicated pages (Declarations,
// Review team, Clients) where the actual work happens.
export default async function AdminDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/user");

  const [allUsers, queue] = await Promise.all([getAdminOverview(), getQueue()]);
  const clients = allUsers.filter((u) => u.role === "user");
  const reviewers = allUsers.filter((u) => u.role === "reviewer");
  const submitted = queue.filter((q) => q.status === "submitted");
  const awaiting = submitted.filter((q) => !q.frozen);
  const unassigned = awaiting.filter((q) => !q.assigned_reviewer_oid);
  const approved = queue.filter((q) => Boolean(q.frozen));
  const cutoff = Date.now() - 30 * 86_400_000;
  const firstName = (user.name || "").split(" ")[0] || "there";

  const kpis = [
    { label: "Clients", value: clients.length, icon: Users },
    { label: "Reviewers", value: reviewers.length, icon: UserCog },
    { label: "Awaiting review", value: awaiting.length, icon: Clock },
    { label: "Approved returns", value: approved.length, icon: CheckCircle2 },
    { label: "New clients (30 days)", value: clients.filter((u) => u.created_at && new Date(u.created_at).getTime() >= cutoff).length, icon: UserPlus },
    { label: "Business owners", value: clients.filter((u) => u.owns_establishment).length, icon: Building2 },
    { label: "Documents on file", value: allUsers.reduce((s, u) => s + u.documents, 0), icon: FolderOpen },
    { label: "Declarations", value: queue.length, icon: ClipboardList },
  ];

  const shortcuts = [
    {
      href: "/dashboard/admin/declarations",
      icon: ClipboardList,
      title: "Declarations",
      sub: `${awaiting.length} awaiting review · ${unassigned.length} unassigned`,
    },
    {
      href: "/dashboard/admin/team",
      icon: UserCog,
      title: "Review team",
      sub: `${reviewers.length} reviewer${reviewers.length === 1 ? "" : "s"} — invite, promote, manage`,
    },
    {
      href: "/dashboard/admin/clients",
      icon: Users,
      title: "Clients",
      sub: `${clients.length} client account${clients.length === 1 ? "" : "s"} with full detail`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-white p-6 sm:p-8 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-zinc-950 dark:to-zinc-950">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/10 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
          Admin workspace
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {unassigned.length > 0 ? (
            <>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {unassigned.length} submitted declaration{unassigned.length > 1 ? "s" : ""}
              </span>{" "}
              {unassigned.length > 1 ? "have" : "has"} no reviewer yet — assign them so the work
              keeps moving.
            </>
          ) : awaiting.length > 0 ? (
            `All submitted declarations are assigned — ${awaiting.length} still in review.`
          ) : (
            "All caught up. New submissions will appear under Declarations."
          )}
        </p>
        {unassigned.length > 0 && (
          <Link
            href="/dashboard/admin/declarations"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            Assign declarations <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Key numbers">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
                  {k.value}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Shortcuts into the working pages */}
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Sections">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:border-amber-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-amber-500/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400/25 to-amber-500/10 text-amber-700 dark:text-amber-400">
              <s.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{s.title}</span>
              <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{s.sub}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-500" />
          </Link>
        ))}
      </section>
    </div>
  );
}
