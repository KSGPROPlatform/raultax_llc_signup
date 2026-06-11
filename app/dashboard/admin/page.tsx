import { Users, ShieldCheck, UserCircle, type LucideIcon } from "lucide-react";
import { getAllUsers, type AppUser } from "@/lib/users";
import { UsersTable } from "@/components/dashboard/UsersTable";

// Sample rows shown until Azure SQL credentials are set (getAllUsers -> null).
const MOCK_USERS: AppUser[] = [
  { id: 1, entra_object_id: "11111111-1111-1111-1111-111111111111", name: "Raul Peter", email: "petzyrockchendi@gmail.com", tenant_id: null, role: "admin", created_at: "2026-05-02T10:00:00Z", updated_at: "2026-06-01T10:00:00Z" },
  { id: 2, entra_object_id: "22222222-2222-2222-2222-222222222222", name: "Amara Okeke", email: "amara@example.com", tenant_id: null, role: "user", created_at: "2026-05-10T10:00:00Z", updated_at: "2026-05-10T10:00:00Z" },
  { id: 3, entra_object_id: "33333333-3333-3333-3333-333333333333", name: "Daniel Cruz", email: "daniel@example.com", tenant_id: null, role: "user", created_at: "2026-05-18T10:00:00Z", updated_at: "2026-05-18T10:00:00Z" },
  { id: 4, entra_object_id: "44444444-4444-4444-4444-444444444444", name: "Mei Lin", email: "mei@example.com", tenant_id: null, role: "user", created_at: "2026-05-25T10:00:00Z", updated_at: "2026-05-25T10:00:00Z" },
  { id: 5, entra_object_id: "55555555-5555-5555-5555-555555555555", name: "Tunde Bello", email: "tunde@example.com", tenant_id: null, role: "admin", created_at: "2026-06-02T10:00:00Z", updated_at: "2026-06-02T10:00:00Z" },
];

export default async function AdminPage() {
  const dbUsers = await getAllUsers();
  const usingMock = dbUsers === null;
  const users = dbUsers ?? MOCK_USERS;

  const total = users.length;
  const admins = users.filter((u) => u.role === "admin").length;
  const standard = total - admins;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Review and manage everyone who has signed up.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={total} icon={Users} />
        <StatCard label="Admins" value={admins} icon={ShieldCheck} />
        <StatCard label="Standard users" value={standard} icon={UserCircle} />
      </div>

      <section id="users" className="scroll-mt-20">
        <UsersTable initialUsers={users} usingMock={usingMock} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand/15 text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-sm text-muted">{label}</div>
      </div>
    </div>
  );
}
