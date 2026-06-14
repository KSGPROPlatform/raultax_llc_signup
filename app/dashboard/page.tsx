import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

// Protected by middleware.ts; we re-check here as defense-in-depth and to read
// the signed-in user for rendering.
export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <SignOutButton />
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Signed in as
        </h2>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {user.name || user.email || "Account"}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              user.role === "admin"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {user.role ?? "user"}
          </span>
        </div>
        {user.email && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
        )}
        <p className="mt-4 font-mono text-xs text-zinc-400">id: {user.sub}</p>
      </div>
    </main>
  );
}
