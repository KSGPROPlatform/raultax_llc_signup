import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminOverview } from "@/components/dashboard/AdminOverview";
import { AdminDashboardPanels } from "@/components/dashboard/AdminDashboardPanels";

export default async function AdminDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Admin-only: a standard user who lands here is sent to their own dashboard.
  if (user.role !== "admin") redirect("/dashboard/user");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Assign submitted declarations to your review team, manage the team,
          and see every client at a glance.
        </p>
      </header>

      <AdminDashboardPanels />

      <AdminOverview />
    </div>
  );
}
