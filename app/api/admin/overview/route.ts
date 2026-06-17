import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin";

// GET /api/admin/overview — every user + per-user record counts. Admin only.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await getAdminOverview();
  return NextResponse.json({ users });
}
