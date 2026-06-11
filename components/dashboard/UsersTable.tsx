"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import type { AppUser } from "@/lib/users";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

type Draft = {
  entra_object_id: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

const inputCls =
  "w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand";

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UsersTable({
  initialUsers,
  usingMock,
}: {
  initialUsers: AppUser[];
  usingMock: boolean;
}) {
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  function remove(u: AppUser) {
    if (
      confirm(
        `Delete ${u.name ?? u.email ?? "this user"}? (View only for now — not saved.)`,
      )
    ) {
      setUsers((prev) =>
        prev.filter((x) => x.entra_object_id !== u.entra_object_id),
      );
    }
  }

  function save(draft: Draft) {
    setUsers((prev) => {
      const exists = prev.some(
        (x) => x.entra_object_id === draft.entra_object_id,
      );
      if (exists) {
        return prev.map((x) =>
          x.entra_object_id === draft.entra_object_id
            ? { ...x, name: draft.name, email: draft.email, role: draft.role }
            : x,
        );
      }
      const now = new Date().toISOString();
      return [
        {
          id: null,
          entra_object_id: draft.entra_object_id,
          name: draft.name,
          email: draft.email,
          tenant_id: null,
          role: draft.role,
          created_at: now,
          updated_at: now,
        },
        ...prev,
      ];
    });
    setShowForm(false);
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Users</h2>
          <p className="text-xs text-muted">
            {filtered.length} of {users.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="w-full rounded-lg border border-border bg-canvas py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" /> Add user
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.entra_object_id}
                className="border-b border-border/60 last:border-0 hover:bg-elevated/40"
              >
                <td className="px-4 py-3 font-medium">{u.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{u.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">
                  {formatDate(u.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(u);
                        setShowForm(true);
                      }}
                      aria-label="Edit user"
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      aria-label="Delete user"
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  No users match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {usingMock && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Sample data — edits aren’t persisted yet. Connect Azure SQL and we’ll
          wire real create / update / delete.
        </p>
      )}

      {showForm && (
        <UserFormModal
          user={editing}
          onClose={() => setShowForm(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function UserFormModal({
  user,
  onClose,
  onSave,
}: {
  user: AppUser | null;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<"admin" | "user">(user?.role ?? "user");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      entra_object_id: user?.entra_object_id ?? crypto.randomUUID(),
      name: name.trim(),
      email: email.trim(),
      role,
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {user ? "Edit user" : "Add user"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "user")}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {user ? "Save changes" : "Add user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
