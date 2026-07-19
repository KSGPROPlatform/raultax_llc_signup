import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminOverview } from "@/components/dashboard/AdminOverview";

// Dedicated page: every account, searchable, with the full per-client detail
// (profile, dependents, documents, Form 1040 review) behind View.
export default async function AdminClientsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/user");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Clients
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Everyone with an account — open any of them for their profile,
          documents and computed Form 1040.
        </p>
      </header>
      <AdminOverview />
    </div>
  );
}
