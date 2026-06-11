import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Guards the whole /dashboard area and renders the shared shell. No session =>
// back to the welcome page, so dashboard content never renders for a guest.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/");

  const role = session.role ?? "user";
  const profile = (session.profile ?? {}) as Record<string, unknown>;
  const name =
    session.user?.name ?? (profile.name as string | undefined) ?? "Account";
  const email =
    session.user?.email ??
    (profile.email as string | undefined) ??
    (profile.preferred_username as string | undefined) ??
    "";

  // Microsoft end-session endpoint for federated sign-out (derived from issuer).
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  const logoutUrl = issuer.replace(/\/v2\.0\/?$/, "/oauth2/v2.0/logout");

  return (
    <DashboardShell role={role} name={name} email={email} logoutUrl={logoutUrl}>
      {children}
    </DashboardShell>
  );
}
