import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { listFiles, uploadFile, saveDocument, isFilesConfigured } from "@/lib/files";
import { isKnownDocType, isYearScoped, isIdentityChecked } from "@/lib/docTypes";
import { resolveExpectedIdentity } from "@/lib/identity";
import { TAX_YEAR_COOKIE, resolveTaxYear } from "@/lib/taxYear";
import { revertSubmissionToDraft } from "@/lib/profileData";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB app-side cap

// GET /api/files — the signed-in user's files, scoped to the active tax year:
// year-scoped docs (W-2/1099) only show for the selected declaration year;
// identity docs (SSN card, ID) always show.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();
  const year = resolveTaxYear(jar.get(TAX_YEAR_COOKIE)?.value);
  const all = await listFiles(user.sub);
  const files = all.filter(
    (f) => !isYearScoped(f.doc_type) || (f.tax_year ?? null) === year,
  );
  return NextResponse.json({ files, taxYear: year });
}

// POST /api/files — multipart "file" upload; forwarded to the function which
// compresses images (<1MB) and stores them in Blob, stamped with the active
// declaration year. SSN-card slots require the typed name+SSN to exist first.
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
    const contentType = file.type || "application/octet-stream";
    // Optional document category + per-job link. Single-file slots replace via saveDocument.
    const docTypeRaw = form.get("docType");
    const docType = typeof docTypeRaw === "string" && isKnownDocType(docTypeRaw) ? docTypeRaw : null;
    const jobIdRaw = form.get("jobId");
    const jobId = typeof jobIdRaw === "string" && /^\d+$/.test(jobIdRaw) ? Number(jobIdRaw) : null;

    // The active declaration year stamps every upload.
    const jar = await cookies();
    const taxYear = resolveTaxYear(jar.get(TAX_YEAR_COOKIE)?.value);

    // Precondition for identity-checked docs (SSN cards): the name + SSN they'll
    // be verified against must exist — the saved record wins, else the values
    // typed in the form (sent along by DocUpload).
    if (docType && isIdentityChecked(docType)) {
      const expName = form.get("expectedName");
      const expSsn = form.get("expectedSsn");
      const expected = await resolveExpectedIdentity(user.sub, docType, {
        name: typeof expName === "string" ? expName : null,
        ssn: typeof expSsn === "string" ? expSsn : null,
      });
      if (!expected.ssn || !expected.name) {
        return NextResponse.json(
          { error: "Enter the name and Social Security number first — then upload the SSN card so we can verify it." },
          { status: 400 },
        );
      }
    }

    const saved = docType
      ? await saveDocument(user.sub, file.name, contentType, bytes, docType, jobId, taxYear)
      : await uploadFile(user.sub, file.name, contentType, bytes, null, null, taxYear);
    await revertSubmissionToDraft(user.sub, taxYear);
    return NextResponse.json({ file: saved }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    if (!(err instanceof Error)) console.error("file upload failed:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
