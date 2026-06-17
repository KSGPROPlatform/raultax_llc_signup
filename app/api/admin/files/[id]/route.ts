import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { viewFile } from "@/lib/files";

// GET /api/admin/files/:id?oid=<owner>[&download=1] — admin views/downloads any
// user's document. Admin only; the owner oid is required to scope the lookup.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const fileId = Number(id);
  const ownerOid = new URL(request.url).searchParams.get("oid");
  if (!Number.isInteger(fileId) || !ownerOid) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = await viewFile(ownerOid, fileId);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download");
  const disposition = download ? "attachment" : "inline";
  const safeName = file.name.replace(/["\\\r\n]/g, "_");
  return new NextResponse(file.bytes, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
