import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listFiles, uploadFile, isFilesConfigured } from "@/lib/files";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB app-side cap

// GET /api/files — the signed-in user's files.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const files = await listFiles(user.sub);
  return NextResponse.json({ files });
}

// POST /api/files — multipart "file" upload; forwarded to the function which
// compresses (if large) and stores it in Blob.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFilesConfigured()) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The file is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25 MB)." }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const saved = await uploadFile(
      user.sub,
      file.name,
      file.type || "application/octet-stream",
      bytes,
    );
    return NextResponse.json({ file: saved }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    if (!(err instanceof Error)) console.error("file upload failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
