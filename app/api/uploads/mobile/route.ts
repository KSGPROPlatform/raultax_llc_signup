import { NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/uploadToken";
import { listFiles, saveDocument, uploadFile, isFilesConfigured } from "@/lib/files";
import { revertSubmissionToDraft } from "@/lib/profileData";
import { allowedTaxYears } from "@/lib/taxYear";
import { isKnownDocType } from "@/lib/docTypes";

const MAX_BYTES = 25 * 1024 * 1024;

// GET /api/uploads/mobile?token=… — list the token-owner's files (so the phone
// can show what's already uploaded). Token-authorised; no session.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const auth = await verifyUploadToken(token);
  if (!auth) return NextResponse.json({ error: "Link expired" }, { status: 401 });
  const files = await listFiles(auth.oid);
  return NextResponse.json({ files });
}

// POST /api/uploads/mobile — multipart { token, docType?, file }. Stores a
// document for the token-owner. Token-authorised; no session.
export async function POST(request: Request) {
  if (!isFilesConfigured()) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
  }
  try {
    const form = await request.formData();
    const token = form.get("token");
    const auth = await verifyUploadToken(typeof token === "string" ? token : null);
    if (!auth) {
      return NextResponse.json(
        { error: "This link has expired. Generate a new QR code on your computer." },
        { status: 401 },
      );
    }

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

    // The token's target slot wins (a phone can only upload where the QR was
    // for); fall back to the form's docType for a generic token.
    const docTypeRaw = form.get("docType");
    const formDocType =
      typeof docTypeRaw === "string" && isKnownDocType(docTypeRaw) ? docTypeRaw : null;
    const docType = auth.docType ?? formDocType;
    const jobId = auth.jobId ?? null;
    const taxYear = auth.taxYear ?? null; // the declaration year baked into the QR

    const bytes = await file.arrayBuffer();
    const contentType = file.type || "application/octet-stream";
    const saved = docType
      ? await saveDocument(auth.oid, file.name, contentType, bytes, docType, jobId, taxYear)
      : await uploadFile(auth.oid, file.name, contentType, bytes, null, null, taxYear);
    // Mirror uploadFile's fallback: no token year -> latest declarable year.
    await revertSubmissionToDraft(auth.oid, taxYear ?? allowedTaxYears()[0]);
    return NextResponse.json({ file: saved }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
