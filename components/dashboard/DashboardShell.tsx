"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";
import { RoleBadge } from "./RoleBadge";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ToastProvider } from "@/components/ui/Toast";

type NavItem = { label: string; href: string; icon: LucideIcon };

export function DashboardShell({
  role,
  name,
  email,
  children,
}: {
  role: Role;
  name: string;
  email: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const home = role === "admin" ? "/dashboard/admin" : "/dashboard/user";
  const nav: NavItem[] =
    role === "admin"
      ? [{ label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard }]
      : [
          { label: "Dashboard", href: "/dashboard/user", icon: LayoutDashboard },
          { label: "My Form 1040", href: "/dashboard/return", icon: FileText },
        ];

  const initial = (name || email || "?").charAt(0).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href={home} className="flex items-center gap-2 px-6 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-sm font-bold text-zinc-950">
          r
        </span>
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          raultax
        </span>
      </Link>

      <nav className="flex-1 px-3" aria-label="Dashboard">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Menu
        </p>
        <div className="space-y-1">
        {nav.map((item) => {
          const base = item.href.split("#")[0];
          const active =
            item.href.startsWith("/dashboard") &&
            (pathname === base || pathname.startsWith(base + "/") ||
             (base === "/dashboard/user" && pathname.startsWith("/dashboard/declaration")));
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-sm font-semibold text-amber-600 dark:text-amber-400">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {name || "Account"}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {email}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <RoleBadge role={role} />
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
    <div className="flex min-h-dvh bg-zinc-50 dark:bg-black">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            raultax
          </span>
          <div className="ml-auto">
            <RoleBadge role={role} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
