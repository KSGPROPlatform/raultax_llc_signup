import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Guards the whole /dashboard area (defense-in-depth alongside proxy.ts) and
// renders the shared sidebar/topbar shell.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  // Onboarding is optional and invited from the dashboard (see ProfileChecklist),
  // so we no longer force unfinished users into /onboarding here.

  return (
    <DashboardShell
      role={user.role ?? "user"}
      name={user.name ?? ""}
      email={user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
