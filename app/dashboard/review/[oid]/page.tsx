import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getAdminUserDetail, getReviewerQueue } from "@/lib/admin";
import { TaxReturnReview } from "@/components/dashboard/TaxReturnReview";
import { maskTail } from "@/components/profile/mask";

// One assigned client: identity summary + the full review panel (recompute,
// per-line overrides, approve & freeze) — scoped by assignment server-side.
export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ oid: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "reviewer" && user.role !== "admin") redirect("/dashboard/user");

  const { oid } = await params;
  const queue = await getReviewerQueue(user.sub);
  const mine = queue.filter((r) => r.owner_oid === oid);
  if (mine.length === 0) redirect("/dashboard/review");

  const detail = await getAdminUserDetail(oid);
  const u = detail?.user;
  const fullName = u
    ? [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || u.name || "—"
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/review"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my queue
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Client</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {fullName}
          </h1>
          <div className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <p className="text-zinc-500 dark:text-zinc-400">
              Email <span className="font-medium text-zinc-900 dark:text-zinc-100">{u?.email || "—"}</span>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              SSN <span className="font-medium text-zinc-900 dark:text-zinc-100">{maskTail(u?.ssn ?? "")}</span>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              Filing status <span className="font-medium text-zinc-900 dark:text-zinc-100">{u?.filing_status || "—"}</span>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              Assigned years{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {mine.map((r) => r.tax_year).join(", ")}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Tax return (Form 1040)
        </h2>
        <TaxReturnReview oid={oid} apiBase="/api/review" />
      </div>
    </div>
  );
}
