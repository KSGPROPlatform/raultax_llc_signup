import "server-only";

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
): Promise<UserFile> {
  const res = await fetch(fnUrl("uploadFile", { oid, filename, contentType }), {
    method: "POST",
    headers: { ...APP_HEADERS, "Content-Type": "application/octet-stream" },
    body: bytes,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(msg.error ?? "Upload failed");
  }
  const file = (await res.json()) as UserFile;
  return { ...file, is_compressed: Boolean(file.is_compressed) };
}

export async function deleteFile(oid: string, id: number): Promise<void> {
  const res = await fetch(fnUrl("deleteFile", { oid, id }), {
    method: "DELETE",
    headers: APP_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Delete failed");
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
