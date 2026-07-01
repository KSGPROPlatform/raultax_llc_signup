import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { analyzeDocument, getExtraction } from "@/lib/files";

// POST /api/files/:id/analyze — run Document Intelligence over the file and store
// the extracted fields. GET returns the stored extraction (for polling/display).
// Both owner-scoped via the verified session oid.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const extraction = await analyzeDocument(user.sub, fileId);
  return NextResponse.json({ extraction });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const extraction = await getExtraction(user.sub, fileId);
  return NextResponse.json({ extraction });
}
