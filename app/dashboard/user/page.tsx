import {
  Building2,
  FileText,
  UploadCloud,
  Plus,
  Mail,
  Hash,
  ArrowRight,
  Download,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RoleBadge } from "@/components/dashboard/RoleBadge";

const COMPANIES = [
  { name: "Raul Holdings LLC", state: "Delaware", status: "Active", ein: "88-1234567" },
  { name: "Peter Ventures LLC", state: "Wyoming", status: "Pending", ein: "—" },
];

const DOCUMENTS = [
  { name: "Articles_of_Organization.pdf", size: "240 KB", date: "May 12, 2026" },
  { name: "EIN_Confirmation_CP575.pdf", size: "112 KB", date: "May 14, 2026" },
  { name: "Operating_Agreement.docx", size: "88 KB", date: "May 20, 2026" },
];

const QUICK_ACTIONS = [
  { label: "Start a new filing", desc: "Form a new LLC", icon: Plus },
  { label: "Upload a document", desc: "Add to your vault", icon: UploadCloud },
  { label: "View all filings", desc: "Track your companies", icon: Building2 },
];

const cardClass =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

export default async function UserDashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const name = user.name || user.email || "there";
  const first = name.split(" ")[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back, {first}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your companies, filings, and documents in one place.
        </p>
      </header>

      {/* Profile */}
      <section className={`${cardClass} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-amber-500/15 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {user.name || "Account"}
              </h2>
              <RoleBadge role={user.role ?? "user"} />
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={user.email ?? "—"} />
              <InfoRow icon={Hash} label="Account ID" value={user.sub} mono />
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 sm:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            className={`${cardClass} group flex items-center gap-3 p-4 text-left transition-colors hover:border-amber-400 dark:hover:border-amber-500/50`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {a.label}
              </span>
              <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                {a.desc}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-amber-500 dark:text-zinc-600" />
          </button>
        ))}
      </section>

      {/* Companies */}
      <section id="companies" className="scroll-mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            My companies
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Plus className="h-4 w-4" /> New company
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPANIES.map((c) => (
            <div key={c.name} className={`${cardClass} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {c.name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {c.state} · LLC
                    </div>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-4 border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                EIN:{" "}
                <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
                  {c.ein}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Documents */}
      <section id="documents" className="scroll-mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Documents
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {DOCUMENTS.map((f, i) => (
            <div
              key={f.name}
              className={`flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950 ${
                i !== 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {f.name}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {f.size} · {f.date}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Download ${f.name}`}
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          Sample data — wire these to your filings/documents store next.
        </p>
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
      <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
      <span className="text-zinc-500 dark:text-zinc-400">{label}:</span>
      <span
        className={`truncate text-zinc-900 dark:text-zinc-50 ${mono ? "font-mono text-xs" : ""}`}
      >
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
        active
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
          : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
      }`}
    >
      {status}
    </span>
  );
}
