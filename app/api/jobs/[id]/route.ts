import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteJob } from "@/lib/profileData";

// DELETE /api/jobs/:id — owner-scoped (also detaches the job's files).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    await deleteJob(user.sub, n);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
