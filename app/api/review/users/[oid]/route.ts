import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminUserDetail, getReviewerQueue } from "@/lib/admin";

// A reviewer may see a client's detail ONLY when at least one of that client's
// declarations is assigned to them.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ oid: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "reviewer" && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { oid } = await params;
  const queue = await getReviewerQueue(user.sub);
  if (!queue.some((r) => r.owner_oid === oid)) {
    return NextResponse.json({ error: "Not assigned to you." }, { status: 403 });
  }
  const detail = await getAdminUserDetail(oid);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}
