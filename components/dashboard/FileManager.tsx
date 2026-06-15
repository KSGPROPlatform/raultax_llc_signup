"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  Download,
  Trash2,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import type { UserFile } from "@/lib/files";

function fmtSize(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function previewKind(ct: string | null): "image" | "pdf" | "none" {
  if (!ct) return "none";
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf") return "pdf";
  return "none";
}

export function FileManager() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<UserFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the file list client-side so a cold Function never blocks the page.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/files");
        if (res.ok) {
          const data = await res.json();
          if (active) setFiles(data.files ?? []);
        }
      } catch {
        /* leave empty — the user can still upload */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setError(null);
    for (const f of Array.from(list)) {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.set("file", f);
        const res = await fetch("/api/files", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || `Could not upload ${f.name}.`);
          continue;
        }
        setFiles((prev) => [data.file as UserFile, ...prev]);
      } catch {
        setError("Network error during upload.");
      } finally {
        setBusy(false);
      }
    }
  }

  async function remove(f: UserFile) {
    if (!confirm(`Delete "${f.original_name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" });
    if (res.ok) setFiles((prev) => prev.filter((x) => x.id !== f.id));
    else setError("Could not delete the file.");
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-amber-400 bg-amber-500/5"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
        }`}
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Upload a document
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Drag &amp; drop or choose a file (up to 25 MB). Large files are
          compressed automatically.
        </p>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </>
          ) : (
            "Choose file"
          )}
        </button>
      </div>

      {/* File list */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950 ${
                i !== 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""
              }`}
            >
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-2.5 w-1/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {files.map((f, i) => {
            const k = previewKind(f.content_type);
            return (
              <div
                key={f.id}
                className={`flex items-center gap-3 bg-white px-4 py-3 dark:bg-zinc-950 ${
                  i !== 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {f.original_name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fmtSize(f.size_bytes)} · {fmtDate(f.uploaded_at)}
                    {f.is_compressed ? " · compressed" : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  {k !== "none" && (
                    <button
                      type="button"
                      onClick={() => setPreview(f)}
                      aria-label={`Preview ${f.original_name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <a
                    href={`/api/files/${f.id}?download=1`}
                    aria-label={`Download ${f.original_name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(f)}
                    aria-label={`Delete ${f.original_name}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          No documents yet. Upload your first file above.
        </p>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setPreview(null)}
            aria-hidden
          />
          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="truncate text-sm font-medium text-zinc-50">
                {preview.original_name}
              </span>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/files/${preview.id}?download=1`}
                  aria-label="Download"
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  aria-label="Close preview"
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-zinc-900">
              {previewKind(preview.content_type) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/${preview.id}`}
                  alt={preview.original_name}
                  className="mx-auto max-h-[75vh] w-auto"
                />
              ) : (
                <iframe
                  src={`/api/files/${preview.id}`}
                  title={preview.original_name}
                  className="h-[75vh] w-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
