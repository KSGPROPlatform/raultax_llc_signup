import { Users, ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { StatCard } from "@/components/dashboard/StatCard";
import { UsersTable, type AdminUser } from "@/components/dashboard/UsersTable";

// Sample rows until a getAllUsers function/endpoint is wired to raul_tax_users.
const SAMPLE_USERS: AdminUser[] = [
  { entra_object_id: "1", name: "Angelia Azieh", email: "petzyrockchendi@gmail.com", role: "admin", created_at: "2026-06-14T06:28:01Z" },
  { entra_object_id: "2", name: "Amara Okeke", email: "amara@example.com", role: "user", created_at: "2026-05-10T10:00:00Z" },
  { entra_object_id: "3", name: "Daniel Cruz", email: "daniel@example.com", role: "user", created_at: "2026-05-18T10:00:00Z" },
  { entra_object_id: "4", name: "Mei Lin", email: "mei@example.com", role: "user", created_at: "2026-05-25T10:00:00Z" },
  { entra_object_id: "5", name: "Tunde Bello", email: "tunde@example.com", role: "admin", created_at: "2026-06-02T10:00:00Z" },
];

export default async function AdminDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Admin-only: a standard user who lands here is sent to their own dashboard.
  if (user.role !== "admin") redirect("/dashboard/user");

  const users = SAMPLE_USERS;
  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const standard = total - admins;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Review and manage everyone who has signed up.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={total} icon={Users} />
        <StatCard label="Admins" value={admins} icon={ShieldCheck} />
        <StatCard label="Standard users" value={standard} icon={UserRound} />
      </div>

      <section id="users" className="scroll-mt-6">
        <UsersTable users={users} sample />
      </section>
    </div>
  );
}
