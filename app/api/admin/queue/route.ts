import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQueue, assignReviewer } from "@/lib/admin";

// The admin's declarations queue.
//   GET   -> every declaration with owner + assigned reviewer
//   PATCH { oid, taxYear, reviewerOid|null } -> assign / unassign

async function adminSession() {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const s = await adminSession();
  if ("error" in s) return s.error;
  return NextResponse.json({ rows: await getQueue() });
}

export async function PATCH(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const body = await request.json().catch(() => ({}));
  const oid = String(body.oid ?? "");
  const taxYear = Number(body.taxYear);
  const reviewerOid = body.reviewerOid ? String(body.reviewerOid) : null;
  if (!oid || !Number.isInteger(taxYear)) {
    return NextResponse.json({ error: "oid and taxYear are required." }, { status: 400 });
  }
  const result = await assignReviewer(oid, taxYear, reviewerOid);
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error ?? "Could not assign the reviewer." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
