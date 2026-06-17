import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminUserDetail } from "@/lib/admin";

// GET /api/admin/users/:oid — one user's full profile + related records. Admin only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ oid: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { oid } = await params;
  const detail = await getAdminUserDetail(oid);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}
