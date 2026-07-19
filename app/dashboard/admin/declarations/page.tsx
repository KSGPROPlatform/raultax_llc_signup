import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminQueue } from "@/components/dashboard/AdminQueue";

// Dedicated page: every submitted declaration, assigned to reviewers from here.
export default async function AdminDeclarationsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/user");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Declarations
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Every submitted declaration across your clients — hand each one to a
          reviewer, or open the client for the full picture.
        </p>
      </header>
      <AdminQueue />
    </div>
  );
}
