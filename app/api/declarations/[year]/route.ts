import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAllowedTaxYear } from "@/lib/taxYear";
import { deleteDeclaration } from "@/lib/profileData";

// DELETE /api/declarations/:year — remove the year's declaration and ALL its
// data (per-year rows + that year's W-2/1099 documents). The backend refuses
// (409) when the return is frozen (preparer approved).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { year } = await params;
  if (!isAllowedTaxYear(year)) {
    return NextResponse.json({ error: "Invalid tax year." }, { status: 400 });
  }
  const result = await deleteDeclaration(user.sub, Number(year));
  if (!result.ok) {
    const status = result.error?.includes("approved") ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
