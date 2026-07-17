import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Sends each user to the right dashboard based on the role resolved at sign-in
// (stored in the session). Admins -> admin area, everyone else -> user area.
export default async function DashboardIndex() {
  const user = await getSession();
  if (!user) redirect("/login");
  redirect(
    user.role === "admin"
      ? "/dashboard/admin"
      : user.role === "reviewer"
        ? "/dashboard/review"
        : "/dashboard/user",
  );
}
