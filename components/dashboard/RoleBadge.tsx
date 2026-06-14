import { ShieldCheck, User } from "lucide-react";
import type { Role } from "@/lib/session";

export function RoleBadge({ role }: { role: Role }) {
  const admin = role === "admin";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        admin
          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {admin ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
      {admin ? "Admin" : "User"}
    </span>
  );
}
