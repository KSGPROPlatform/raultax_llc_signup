import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { viewFile, deleteFile } from "@/lib/files";

// GET /api/files/:id        -> serves the file INLINE (preview)
// GET /api/files/:id?download=1 -> serves it as an ATTACHMENT (download)
// Same-origin + cookie-authed, so <img>/<iframe>/<a> can point straight here.
export async function GET(
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

  const file = await viewFile(user.sub, fileId);
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

// DELETE /api/files/:id — remove blob + metadata, owner-scoped.
export async function DELETE(
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

  try {
    await deleteFile(user.sub, fileId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
