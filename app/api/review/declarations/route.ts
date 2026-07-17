import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/admin";

// Year pills for the reviewer's review panel: ONLY the assigned years of the
// given user (mirrors /api/admin/declarations, scoped by assignment).
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "reviewer" && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const oid = new URL(request.url).searchParams.get("oid") ?? "";
  if (!oid) return NextResponse.json({ error: "oid is required" }, { status: 400 });
  const queue = await getReviewerQueue(user.sub);
  const rows = queue
    .filter((r) => r.owner_oid === oid)
    .map((r) => ({ tax_year: r.tax_year, status: r.status }));
  return NextResponse.json({ rows });
}
