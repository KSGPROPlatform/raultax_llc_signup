import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { analyzeDocument, getExtraction } from "@/lib/files";
import { isIdentityChecked, isYearScoped } from "@/lib/docTypes";
import { resolveExpectedIdentity } from "@/lib/identity";

// POST /api/files/:id/analyze — run Document Intelligence over the file and store
// the extracted fields. For identity-checked docs (SSN cards) the expected name +
// SSN are resolved server-side (saved record wins, the form's typed values as
// fallback) and passed to the function, which rejects mismatches. GET returns the
// stored extraction (for polling/display). Both owner-scoped via the session oid.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    docType?: string;
    expectedName?: string;
    expectedSsn?: string;
  };
  // SSN cards are matched against the typed identity; W-2/1099 must carry the
  // account holder's SSN (last-4 match — forms usually mask the rest).
  let expected: { name?: string; ssn?: string } | undefined;
  if (
    typeof body.docType === "string" &&
    (isIdentityChecked(body.docType) || isYearScoped(body.docType))
  ) {
    expected = await resolveExpectedIdentity(user.sub, body.docType, {
      name: body.expectedName ?? null,
      ssn: body.expectedSsn ?? null,
    });
  }

  const extraction = await analyzeDocument(user.sub, fileId, expected);
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
