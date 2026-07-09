import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listJobs, saveJob, revertSubmissionToDraft } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// GET /api/jobs — the signed-in user's jobs for the active tax year.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listJobs(user.sub, await activeTaxYear());
  return NextResponse.json({ rows });
}

// POST /api/jobs — create (no id) or update (with id) one job, stamped with the
// active tax year.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const row = await saveJob(
      user.sub,
      {
        id: body.id,
        job_name: body.job_name ?? "",
        occupation: body.occupation ?? "",
        company_name: body.company_name ?? "",
      },
      await activeTaxYear(),
    );
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
