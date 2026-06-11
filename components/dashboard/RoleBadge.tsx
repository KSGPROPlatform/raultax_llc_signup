import { ShieldCheck, User } from "lucide-react";

export function RoleBadge({ role }: { role: "admin" | "user" }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isAdmin ? "bg-brand/15 text-brand" : "bg-elevated text-muted"
      }`}
    >
      {isAdmin ? (
        <ShieldCheck className="h-3 w-3" />
      ) : (
        <User className="h-3 w-3" />
      )}
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}
