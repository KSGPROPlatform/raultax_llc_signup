import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDeclarations } from "@/lib/profileData";

// GET /api/admin/declarations?oid= — a user's declarations (years, status,
// per-year counts) for the preparer's review panel. Admin only.
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const oid = new URL(request.url).searchParams.get("oid");
  if (!oid) return NextResponse.json({ error: "oid is required" }, { status: 400 });
  const rows = await listDeclarations(oid);
  return NextResponse.json({ rows });
}
