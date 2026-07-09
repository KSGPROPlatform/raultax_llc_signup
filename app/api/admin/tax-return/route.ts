import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTaxReturn, computeTaxReturn, patchTaxReturn } from "@/lib/tax";

// Admin (preparer) access to a user's computed 1040.
//   GET   ?oid=&year=  -> the stored row (all lines + flags + overrides)
//   POST  ?oid=&year=  -> recompute from current data (respects freeze)
//   PATCH ?oid=&year=  -> { overrides: {line_x: value|null}, frozen } review actions

async function adminSession() {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

function parseParams(request: Request) {
  const p = new URL(request.url).searchParams;
  const oid = p.get("oid") ?? "";
  const year = Number(p.get("year"));
  return { oid, year, ok: Boolean(oid) && Number.isInteger(year) };
}

export async function GET(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const row = await getTaxReturn(oid, year);
  return NextResponse.json({ return: row });
}

export async function POST(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const result = await computeTaxReturn(oid, year);
  if (!result) return NextResponse.json({ error: "Computation failed." }, { status: 502 });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const { oid, year, ok } = parseParams(request);
  if (!ok) return NextResponse.json({ error: "oid and year are required" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as {
    overrides?: Record<string, number | null>;
    frozen?: boolean;
  };
  const result = await patchTaxReturn(oid, year, {
    ...body,
    by: s.user.name || s.user.email || "admin",
  });
  if (!result) return NextResponse.json({ error: "Update failed." }, { status: 502 });
  return NextResponse.json(result);
}
