import "server-only";
import { isMultiple } from "./docTypes";
import { allowedTaxYears } from "./taxYear";

// Server-side client for the file Azure Functions (uploadFile / listFiles /
// viewFile / deleteFile) on ksgpro-api. Same base/key as upsertUser. The app's
// route handlers call these with the VERIFIED session oid.
const base = process.env.PROFILE_API_URL;
const key = process.env.PROFILE_API_KEY;
// Tells the shared ksgpro-api which app's table/container to use.
const APP_HEADERS = { "X-App-Id": "raultax" };

export type UserFile = {
  id: number;
  owner_oid: string;
  blob_name: string;
  original_name: string;
  content_type: string | null;
  size_bytes: number | null;
  stored_bytes: number | null;
  is_compressed: boolean;
  doc_type: string | null;
  job_id: number | null;
  tax_year: number | null;
  uploaded_at: string;
};

export function isFilesConfigured(): boolean {
  return Boolean(base);
}

function fnUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${(base ?? "").replace(/\/$/, "")}/${path}`);
  if (key) url.searchParams.set("code", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// Rendered during dashboard SSR — must never throw.
export async function listFiles(oid: string): Promise<UserFile[]> {
  if (!base) return [];
  try {
    const res = await fetch(fnUrl("listFiles", { oid }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("listFiles function returned", res.status);
      return [];
    }
    const rows = (await res.json()) as UserFile[];
    return rows.map((f) => ({ ...f, is_compressed: Boolean(f.is_compressed) }));
  } catch (err) {
    console.error("listFiles failed:", err);
    return [];
  }
}

export async function uploadFile(
  oid: string,
  filename: string,
  contentType: string,
  bytes: ArrayBuffer,
  docType?: string | null,
  jobId?: number | null,
  taxYear?: number | null,
): Promise<UserFile> {
  // Fallback stamp: the latest declarable tax year (in 2026 that's 2025).
  const year = taxYear ?? allowedTaxYears()[0];
  const res = await fetch(
    fnUrl("uploadFile", {
      oid,
      filename,
      contentType,
      docType: docType ?? undefined,
      jobId: jobId ?? undefined,
      taxYear: year,
    }),
    {
      method: "POST",
      headers: { ...APP_HEADERS, "Content-Type": "application/octet-stream" },
      body: bytes,
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(msg.error ?? "Upload failed");
  }
  const file = (await res.json()) as UserFile;
  return { ...file, is_compressed: Boolean(file.is_compressed) };
}

// Upload a categorised document (Form 5). For single-file slots (e.g. SSN copy,
// ID front/back) the previous file of that type is removed so the slot holds
// exactly one. Used by both the web vault and the mobile (QR) upload.
export async function saveDocument(
  oid: string,
  filename: string,
  contentType: string,
  bytes: ArrayBuffer,
  docType: string,
  jobId?: number | null,
  taxYear?: number | null,
): Promise<UserFile> {
  const saved = await uploadFile(oid, filename, contentType, bytes, docType, jobId, taxYear);
  // Single-file slots replace the previous file: per-job docs (W-2/1099) are one
  // per job; non-job docs replace when the catalog marks them single (e.g. SSN).
  const single = jobId != null || (docType && !isMultiple(docType));
  if (single) {
    const all = await listFiles(oid);
    const stale = all.filter(
      (f) =>
        f.doc_type === docType &&
        (f.job_id ?? null) === (jobId ?? null) &&
        f.id !== saved.id,
    );
    await Promise.all(stale.map((f) => deleteFile(oid, f.id).catch(() => {})));
  }
  return saved;
}

// ---- Document Intelligence extraction (one per file) ----
export type Extraction = {
  file_id: number;
  doc_type: string | null;
  model: string | null;
  status: string; // pending | done | unsupported | error | mismatch
  // Present on a rejection ("mismatch"): why + the years involved.
  reason?: string | null; // wrong_document | year_mismatch | year_unreadable | ssn_mismatch | name_mismatch | name_unreadable
  doc_year?: number | null;
  expected_year?: number | null;
  deleted?: boolean;
  fields?: Record<string, unknown> | null; // from POST
  fields_json?: string | null; // from GET (stored)
  error?: string | null;
};

// What an identity-checked document (SSN card) must match — the account
// holder's typed name + SSN, resolved server-side by the analyze route.
export type ExpectedIdentity = { name?: string | null; ssn?: string | null };

// Trigger extraction (blocks until the DI call completes — a few seconds).
export async function analyzeDocument(
  oid: string,
  fileId: number,
  expected?: ExpectedIdentity,
): Promise<Extraction | null> {
  if (!base) return null;
  try {
    const res = await fetch(
      fnUrl("analyzeDocument", {
        oid,
        fileId,
        expectedName: expected?.name || undefined,
        expectedSsn: expected?.ssn || undefined,
      }),
      {
        method: "POST",
        headers: APP_HEADERS,
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as Extraction;
  } catch (err) {
    console.error("analyzeDocument failed:", err);
    return null;
  }
}

// Read the stored extraction (for showing status / prior results).
export async function getExtraction(
  oid: string,
  fileId: number,
): Promise<Extraction | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("analyzeDocument", { oid, fileId }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Extraction | null;
  } catch {
    return null;
  }
}

export async function deleteFile(oid: string, id: number): Promise<void> {
  const res = await fetch(fnUrl("deleteFile", { oid, id }), {
    method: "DELETE",
    headers: APP_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Delete failed");
  // Best-effort: drop the stored extraction so extracted sensitive data (SSN,
  // wages, …) doesn't outlive the deleted/replaced document.
  try {
    await fetch(fnUrl("analyzeDocument", { oid, fileId: id }), {
      method: "DELETE",
      headers: APP_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* ignore — the file itself is already gone */
  }
}

// Returns the decompressed file bytes + original content type, for the app to
// stream to the browser (inline preview or download).
export async function viewFile(
  oid: string,
  id: number,
): Promise<{ contentType: string; name: string; bytes: ArrayBuffer } | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("viewFile", { oid, id }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    return {
      contentType: res.headers.get("Content-Type") || "application/octet-stream",
      name: decodeURIComponent(res.headers.get("X-Original-Name") || "file"),
      bytes: await res.arrayBuffer(),
    };
  } catch (err) {
    console.error("viewFile failed:", err);
    return null;
  }
}
