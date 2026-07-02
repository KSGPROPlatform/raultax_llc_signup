"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  ShieldCheck,
  Building2,
  Briefcase,
  UsersRound,
  FileText,
  UserPlus,
  Search,
  Eye,
  Download,
  X,
  Loader2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { maskTail } from "@/components/profile/mask";
import { docTypeLabel } from "@/lib/docTypes";
import type { AdminUserRow, AdminUserDetail } from "@/lib/admin";

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtMoney(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function AdminOverview() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openOid, setOpenOid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/overview");
        if (res.ok) {
          const d = await res.json();
          if (active) setUsers(d.users ?? []);
        } else if (active) {
          setError("Could not load users.");
        }
      } catch {
        if (active) setError("Could not load users.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const k = useMemo(() => {
    const sum = (f: (u: AdminUserRow) => number) => users.reduce((s, u) => s + f(u), 0);
    const cutoff = Date.now() - 30 * 86_400_000;
    return {
      total: users.length,
      admins: users.filter((u) => u.role === "admin").length,
      onboarded: users.filter((u) => u.onboarding_completed).length,
      businesses: users.filter((u) => u.owns_establishment).length,
      companies: sum((u) => u.companies),
      dependents: sum((u) => u.dependents),
      documents: sum((u) => u.documents),
      recent: users.filter((u) => u.created_at && new Date(u.created_at).getTime() >= cutoff).length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const cards: { label: string; value: number; icon: typeof Users }[] = [
    { label: "Total users", value: k.total, icon: Users },
    { label: "Onboarded", value: k.onboarded, icon: UserCheck },
    { label: "New (30 days)", value: k.recent, icon: UserPlus },
    { label: "Admins", value: k.admins, icon: ShieldCheck },
    { label: "Business owners", value: k.businesses, icon: Building2 },
    { label: "Companies", value: k.companies, icon: Briefcase },
    { label: "Dependents", value: k.dependents, icon: UsersRound },
    { label: "Documents", value: k.documents, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? [...Array(8)].map((_, i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
            ))
          : cards.map((c) => <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} />)}
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Users</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{filtered.length} of {users.length}</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search users"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-amber-500 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th scope="col" className="px-4 py-3 font-medium">Name</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Onboarding</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Cos.</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Deps.</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Docs</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {users.length === 0 ? "No users yet." : `No users match “${query}”.`}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.entra_object_id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{u.email || "—"}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3">
                      {u.onboarding_completed ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{u.companies}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{u.dependents}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{u.documents}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500 dark:text-zinc-400">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenOid(u.entra_object_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openOid && <UserDetailModal oid={openOid} onClose={() => setOpenOid(null)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-right font-medium text-zinc-900 dark:text-zinc-50">{value || "—"}</span>
    </div>
  );
}

function UserDetailModal({ oid, onClose }: { oid: string; onClose: () => void }) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${oid}`);
        if (res.ok && active) setData(await res.json());
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [oid]);

  const u = data?.user;
  const fullName = u
    ? [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || u.name || "—"
    : "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {loading ? "Loading…" : fullName}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="grid place-items-center py-12 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !data || !u ? (
            <p className="py-12 text-center text-sm text-zinc-500">Could not load this user.</p>
          ) : (
            <div className="space-y-6">
              <Section title="Profile">
                <div className="grid gap-x-8 sm:grid-cols-2">
                  <Row label="Email" value={u.email} />
                  <Row label="Role" value={u.role} />
                  <Row label="Date of birth" value={u.date_of_birth} />
                  <Row label="Filing status" value={u.filing_status} />
                  <Row label="Marital status" value={u.marital_status} />
                  <Row label="Phone" value={u.phone_number} />
                  <Row label="SSN" value={maskTail(u.ssn)} />
                  <Row
                    label="Address"
                    value={[u.street_address, u.city, u.state_province, u.postal_code].filter(Boolean).join(", ")}
                  />
                  <Row label="Owns business" value={u.owns_establishment ? "Yes" : "No"} />
                  <Row label="Onboarding" value={u.onboarding_completed ? "Completed" : "Pending"} />
                  <Row label="Joined" value={fmtDate(u.created_at)} />
                </div>
              </Section>

              <Section title={`Dependents (${data.dependents.length})`}>
                {data.dependents.length ? (
                  <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
                    {data.dependents.map((d) => (
                      <li key={d.id} className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{d.full_name || "—"}</span>
                        {" · "}{d.relationship || "—"}{" · SSN "}{maskTail(d.ssn)}{" · "}{d.date_of_birth || "—"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">None.</p>
                )}
              </Section>

              <Section title={`Bank accounts (${data.bankAccounts.length})`}>
                {data.bankAccounts.length ? (
                  <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
                    {data.bankAccounts.map((b) => (
                      <li key={b.id} className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{b.bank_name || "—"}</span>
                        {" · Acct "}{maskTail(b.account_number)}{" · Routing "}{maskTail(b.routing_number)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">None.</p>
                )}
              </Section>

              <Section title={`Companies (${data.companies.length})`}>
                {data.companies.length ? (
                  <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
                    {data.companies.map((c) => (
                      <li key={c.id} className="px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{c.company_name || "—"}</span>
                        {" · EIN "}{c.ein || "—"}{" · "}{c.activities || "—"}{" · P/L "}{fmtMoney(c.business_expense)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">None.</p>
                )}
              </Section>

              <Section title={`Documents (${data.files.length})`}>
                {data.files.length ? (
                  <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
                    {data.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                          {f.original_name}
                          <span className="text-zinc-400"> · {docTypeLabel(f.doc_type)}</span>
                        </span>
                        <a href={`/api/admin/files/${f.id}?oid=${encodeURIComponent(oid)}`} target="_blank" rel="noreferrer" aria-label="View" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                        <a href={`/api/admin/files/${f.id}?oid=${encodeURIComponent(oid)}&download=1`} aria-label="Download" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">None.</p>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
