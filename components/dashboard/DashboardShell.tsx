"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderClosed,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

type Role = "admin" | "user";
type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Users", href: "/dashboard/admin#users", icon: Users },
  ],
  user: [
    { label: "Dashboard", href: "/dashboard/user", icon: LayoutDashboard },
    { label: "My Companies", href: "/dashboard/user#companies", icon: Building2 },
    { label: "My Files", href: "/dashboard/user#files", icon: FolderClosed },
  ],
};

export function DashboardShell({
  role,
  name,
  email,
  logoutUrl,
  children,
}: {
  role: Role;
  name: string;
  email: string;
  logoutUrl?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const nav = NAV[role] ?? NAV.user;
  const other =
    role === "admin"
      ? { label: "Preview user view", href: "/dashboard/user" }
      : { label: "Preview admin view", href: "/dashboard/admin" };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-bold text-white">
          r
        </div>
        <span className="text-lg font-semibold tracking-tight">raultax</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => {
          const active = pathname === item.href.split("#")[0];
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-elevated hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href={other.href}
          onClick={() => setOpen(false)}
          className="block rounded-lg px-3 py-2 text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground"
        >
          {other.label} →
        </Link>
        <p className="px-3 pt-1 text-[11px] text-muted/70">
          Preview link — role access is enforced later.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-canvas/80 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{name}</div>
              <div className="text-xs leading-tight text-muted">{email}</div>
            </div>
            <RoleBadge role={role} />
            <SignOutButton logoutUrl={logoutUrl} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
