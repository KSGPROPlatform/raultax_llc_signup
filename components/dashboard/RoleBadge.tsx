import { ShieldCheck, User } from "lucide-react";
import type { Role } from "@/lib/session";

export function RoleBadge({ role }: { role: Role }) {
  const style =
    role === "admin"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
      : role === "reviewer"
        ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {role === "user" ? <User className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {role === "admin" ? "Admin" : role === "reviewer" ? "Reviewer" : "User"}
    </span>
  );
}
