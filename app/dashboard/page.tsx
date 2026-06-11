import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Sends each user to the right dashboard based on the role we resolved at
// sign-in. Admins -> admin area, everyone else -> user area.
export default async function DashboardIndex() {
  const session = await auth();
  if (!session) redirect("/");
  redirect(session.role === "admin" ? "/dashboard/admin" : "/dashboard/user");
}
