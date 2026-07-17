import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewerQueue } from "@/lib/admin";
import { getTaxReturn, computeTaxReturn, patchTaxReturn } from "@/lib/tax";

// Reviewer access to an ASSIGNED user's computed 1040 — same powers as the
// admin panel (view lines, recompute, override, approve & freeze), but every
// call verifies the (user, year) is actually assigned to this reviewer.

async function reviewerSession() {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "reviewer" && user.role !== "admin")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

async function assignedOrError(reviewerOid: string, oid: string, year: number) {
  const queue = await getReviewerQueue(reviewerOid);
  const hit = queue.find((r) => r.owner_oid === oid && Number(r.tax_year) === year);
  if (!hit) {
    return NextResponse.json(
      { error: "This declaration isn't assigned to you." },
      { status: 403 },
    );
  }
  return null;
}

function parseParams(request: Request) {
  const p = new URL(request.url).searchParams;
  const oid = p.get("oid") ?? "";
  const year = Number(p.get("year"));
  return { oid, year, ok: Boolean(oid) && Number.isInteger(year) };
}

export async function GET(request: Request) {
  const s = await reviewerSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const denied = await assignedOrError(s.user.sub, oid, year);
  if (denied) return denied;
  return NextResponse.json({ return: await getTaxReturn(oid, year) });
}

export async function POST(request: Request) {
  const s = await reviewerSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const denied = await assignedOrError(s.user.sub, oid, year);
  if (denied) return denied;
  const result = await computeTaxReturn(oid, year);
  if (!result) return NextResponse.json({ error: "Computation failed." }, { status: 502 });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const s = await reviewerSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const denied = await assignedOrError(s.user.sub, oid, year);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as {
    overrides?: Record<string, number | null>;
    frozen?: boolean;
  };
  const result = await patchTaxReturn(oid, year, {
    ...body,
    by: s.user.name || s.user.email || "reviewer",
  });
  if (!result) return NextResponse.json({ error: "Update failed." }, { status: 502 });
  return NextResponse.json(result);
}
