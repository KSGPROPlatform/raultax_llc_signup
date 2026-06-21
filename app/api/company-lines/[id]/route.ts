import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteCompanyLine } from "@/lib/profileData";

// DELETE /api/company-lines/:id — owner-scoped (recomputes the company's net).
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
    await deleteCompanyLine(user.sub, n);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
