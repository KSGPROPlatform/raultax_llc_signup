import {
  Building2,
  FileText,
  UploadCloud,
  Eye,
  Download,
  Mail,
  Hash,
  CalendarDays,
  Plus,
} from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserByOid } from "@/lib/users";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

const MOCK_COMPANIES = [
  { name: "Raul Holdings LLC", state: "Delaware", status: "Active", ein: "88-1234567" },
  { name: "Peter Ventures LLC", state: "Wyoming", status: "Pending", ein: "—" },
];

const MOCK_FILES = [
  { name: "Articles_of_Organization.pdf", size: "240 KB", date: "May 12, 2026" },
  { name: "EIN_Confirmation_CP575.pdf", size: "112 KB", date: "May 14, 2026" },
  { name: "Operating_Agreement.docx", size: "88 KB", date: "May 20, 2026" },
];

export default async function UserDashboardPage() {
  const session = await auth();
  if (!session) redirect("/");

  const profile = (session.profile ?? {}) as Record<string, unknown>;
  const name =
    session.user?.name ?? (profile.name as string | undefined) ?? "Account";
  const email =
    session.user?.email ??
    (profile.email as string | undefined) ??
    (profile.preferred_username as string | undefined) ??
    "—";
  const oid = (profile.oid as string | undefined) ?? "—";
  const role = session.role ?? "user";

  const dbUser = oid !== "—" ? await getUserByOid(oid) : null;
  const memberSince = dbUser?.created_at
    ? new Date(dbUser.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your profile, companies, and documents in one place.
        </p>
      </header>

      {/* Profile */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand/15 text-2xl font-semibold text-brand">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{name}</h2>
              <RoleBadge role={role} />
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={email} />
              <InfoRow icon={CalendarDays} label="Member since" value={memberSince} />
              <InfoRow icon={Hash} label="Account ID" value={oid} mono />
            </div>
          </div>
        </div>
      </section>

      {/* Companies */}
      <section id="companies" className="scroll-mt-20 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Companies</h2>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-2 text-sm font-medium transition-colors hover:bg-border"
          >
            <Plus className="h-4 w-4" /> New company
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {MOCK_COMPANIES.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-elevated text-muted">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">{c.state} · LLC</div>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-4 border-t border-border pt-3 text-sm text-muted">
                EIN: <span className="tabular-nums text-foreground">{c.ein}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Files */}
      <section id="files" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold">My Files</h2>

        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-brand">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium">Upload a document</p>
          <p className="text-xs text-muted">PDF, DOCX, or images up to 10 MB</p>
          <button
            type="button"
            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Choose files
          </button>
          <p className="mt-2 text-[11px] text-muted/70">
            Viewing only for now — uploads get wired next.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {MOCK_FILES.map((f, i) => (
            <div
              key={f.name}
              className={`flex items-center gap-3 px-4 py-3 ${
                i !== 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-muted">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted">
                  {f.size} · {f.date}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="View file"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Download file"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-muted" />
      <span className="text-muted">{label}:</span>
      <span className={`truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status.toLowerCase() === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
      }`}
    >
      {status}
    </span>
  );
}
