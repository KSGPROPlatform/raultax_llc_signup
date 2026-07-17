"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/session";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ToastProvider } from "@/components/ui/Toast";

type NavItem = { label: string; href: string; icon: LucideIcon };

// First letters of the first two words — "Kingsley Anye" -> "KA".
function initialsOf(name: string, email: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email || "?").charAt(0).toUpperCase();
}

// The top-bar title mirrors the sidebar so every page reads as one app.
function pageTitle(pathname: string, role: Role): string {
  if (pathname.startsWith("/dashboard/declaration")) return "Tax declaration";
  if (pathname.startsWith("/dashboard/return")) return "My Form 1040";
  if (pathname.startsWith("/dashboard/admin")) return "Overview";
  if (pathname.startsWith("/dashboard/review")) return "Review queue";
  return role === "admin" ? "Overview" : role === "reviewer" ? "Review queue" : "Dashboard";
}

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

  const home =
    role === "admin" ? "/dashboard/admin" : role === "reviewer" ? "/dashboard/review" : "/dashboard/user";
  const nav: NavItem[] =
    role === "admin"
      ? [{ label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard }]
      : role === "reviewer"
        ? [{ label: "Review queue", href: "/dashboard/review", icon: LayoutDashboard }]
        : [
            { label: "Dashboard", href: "/dashboard/user", icon: LayoutDashboard },
            { label: "My Form 1040", href: "/dashboard/return", icon: FileText },
          ];

  const initials = initialsOf(name, email);
  const displayName = name || email || "Account";

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link href={home} className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500 text-sm font-bold text-zinc-950 shadow-sm">
          r
        </span>
        <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          raultax
        </span>
      </Link>

      {/* Navigation — identical on every page (the shell wraps the whole
          /dashboard area), with an unmistakable active state. */}
      <nav className="flex-1 px-3 pt-2" aria-label="Dashboard">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Menu
        </p>
        <div className="space-y-1">
          {nav.map((item) => {
            const base = item.href.split("#")[0];
            const active =
              item.href.startsWith("/dashboard") &&
              (pathname === base ||
                pathname.startsWith(base + "/") ||
                (base === "/dashboard/user" && pathname.startsWith("/dashboard/declaration")));
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber-500/10 font-semibold text-amber-700 dark:text-amber-400"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-amber-500"
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Account */}
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900/60">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="truncate">{displayName}</span>
              {role === "admin" && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
              {role === "reviewer" && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                  <ShieldCheck className="h-3 w-3" /> Reviewer
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {email}
            </span>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
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
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-4 grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Persistent top bar — the SAME on every dashboard page, all
              breakpoints: page context on the left, the signed-in person's
              NAME on the right (never their role or an id). */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {pageTitle(pathname, role)}
            </h2>
            <div className="ml-auto flex min-w-0 items-center gap-2.5">
              <span className="hidden max-w-48 truncate text-sm font-medium text-zinc-700 sm:block dark:text-zinc-300">
                {displayName}
              </span>
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400"
                aria-hidden
              >
                {initials}
              </div>
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
