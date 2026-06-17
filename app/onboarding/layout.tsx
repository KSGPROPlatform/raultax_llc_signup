import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";

// The onboarding journey requires a session. (Completed users may still revisit
// to review/resume — only the dashboard gate redirects the other direction.)
export default async function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  return <>{children}</>;
}
