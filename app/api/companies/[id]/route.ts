import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteCompany, revertSubmissionToDraft } from "@/lib/profileData";
import { activeTaxYear } from "@/lib/activeYear";

// DELETE /api/companies/:id — owner-scoped.
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
    await deleteCompany(user.sub, n);
    await revertSubmissionToDraft(user.sub, await activeTaxYear());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
