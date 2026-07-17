import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/admin";

// The signed-in reviewer's own queue — only declarations the admin assigned
// to them.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "reviewer" && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ rows: await getReviewerQueue(user.sub) });
}
