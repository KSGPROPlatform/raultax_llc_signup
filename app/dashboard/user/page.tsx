import { CalendarRange, ClipboardList, Send, FolderOpen } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DeclarationsCard } from "@/components/dashboard/DeclarationsCard";
import { listDeclarations } from "@/lib/profileData";
import { listFiles } from "@/lib/files";

// The user dashboard is deliberately lean: a welcome, the KPIs, and the
// declarations hub. Everything else (personal info, spouse, dependents, bank,
// jobs, business, documents) lives inside each year's REVIEW page — opened
// from a declaration row — so the dashboard stays scannable.
export default async function UserDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const name = user.name || user.email || "there";
  const first = name.split(" ")[0];

  const [decls, files] = await Promise.all([
    listDeclarations(user.sub),
    listFiles(user.sub),
  ]);
  const drafts = decls.filter((d) => d.status !== "submitted").length;
  const submitted = decls.filter((d) => d.status === "submitted").length;

  const kpis = [
    { label: "Tax years started", value: decls.length, icon: CalendarRange },
    { label: "In progress", value: drafts, icon: ClipboardList },
    { label: "Submitted", value: submitted, icon: Send },
    { label: "Documents on file", value: files.length, icon: FolderOpen },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {first}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your tax declarations at a glance.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Overview">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums leading-none text-zinc-900 dark:text-zinc-50">
                  {k.value}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {k.label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <DeclarationsCard />
    </div>
  );
}
