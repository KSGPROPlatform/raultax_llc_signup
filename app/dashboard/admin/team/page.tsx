import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminTeam } from "@/components/dashboard/AdminTeam";

// Dedicated page: manage the review team (invite by link, promote, demote).
export default async function AdminTeamPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard/user");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Review team
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Invite reviewers with an account-creation link, and manage who is on
          the team. Reviewers only ever see the declarations you assign to them.
        </p>
      </header>
      <div className="max-w-2xl">
        <AdminTeam />
      </div>
    </div>
  );
}
