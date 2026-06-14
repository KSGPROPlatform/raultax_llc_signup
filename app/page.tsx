import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Entry point: straight to the dashboard if signed in, otherwise to login.
export default async function Home() {
  const user = await getSession();
  redirect(user ? "/dashboard" : "/login");
}
