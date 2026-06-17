"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Eye,
  Download,
  Trash2,
  UploadCloud,
  Smartphone,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { UserFile } from "@/lib/files";
import { DOC_TYPES, OTHER_DOC, DOC_ACCEPT } from "@/lib/docTypes";

function fmtSize(n: number | null) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type Qr = { url: string; qrDataUrl: string; expiresInSec: number };

// Form 5 — the categorised document vault. Reused in the onboarding "Documents"
// step and the dashboard. Includes the QR phone hand-off (live-refreshes as the
// phone uploads).
export function DocumentVault() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } catch {
      /* keep what we have */
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // While the phone panel is open, poll so mobile uploads appear automatically.
  useEffect(() => {
    if (!qr) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [qr, refresh]);

  async function upload(docType: string | null, list: FileList | null) {
    if (!list || !list.length) return;
    setError(null);
    setBusyKey(docType ?? OTHER_DOC.key);
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData();
        fd.set("file", f);
        if (docType) fd.set("docType", docType);
        const res = await fetch("/api/files", { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || `Could not upload ${f.name}.`);
        }
      }
      await refresh();
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(f: UserFile) {
    if (!confirm(`Delete "${f.original_name}"?`)) return;
    const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" });
    if (res.ok) setFiles((prev) => prev.filter((x) => x.id !== f.id));
    else setError("Could not delete the file.");
  }

  async function openPhone() {
    setQrLoading(true);
    setError(null);
    try {
      // Pass the real browser origin so the QR points at the public URL (SWA
      // server headers aren't reliably the public domain).
      const res = await fetch(
        `/api/uploads/handoff?origin=${encodeURIComponent(window.location.origin)}`,
      );
      if (res.ok) setQr(await res.json());
      else setError("Could not start the phone hand-off.");
    } catch {
      setError("Could not start the phone hand-off.");
    } finally {
      setQrLoading(false);
    }
  }

  const known = new Set(DOC_TYPES.map((d) => d.key));
  const otherFiles = files.filter((f) => !f.doc_type || !known.has(f.doc_type));

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Phone hand-off */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Upload from your phone
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Scan a QR code to snap photos of your documents with your camera.
              </div>
            </div>
          </div>
          {!qr ? (
            <button
              type="button"
              onClick={openPhone}
              disabled={qrLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {qrLoading ? "Preparing…" : "Show QR code"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setQr(null)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Done
            </button>
          )}
        </div>
        {qr && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt="QR code to upload from your phone" className="h-44 w-44 rounded-lg bg-white p-2" />
            <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
              Scan with your phone camera. New photos appear here automatically.
            </p>
            <p className="text-[11px] text-zinc-400">
              Link expires in about {Math.round(qr.expiresInSec / 60)} minutes.
            </p>
          </div>
        )}
      </div>

      {/* Document slots */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {DOC_TYPES.map((d) => (
            <Slot
              key={d.key}
              label={d.label}
              hint={d.hint}
              multiple={d.multiple}
              files={files.filter((f) => f.doc_type === d.key)}
              busy={busyKey === d.key}
              onUpload={(list) => upload(d.key, list)}
              onRemove={remove}
            />
          ))}
          <Slot
            label={OTHER_DOC.label}
            multiple
            files={otherFiles}
            busy={busyKey === OTHER_DOC.key}
            onUpload={(list) => upload(null, list)}
            onRemove={remove}
          />
        </div>
      )}
    </div>
  );
}

function Slot({
  label,
  hint,
  multiple,
  files,
  busy,
  onUpload,
  onRemove,
}: {
  label: string;
  hint?: string;
  multiple: boolean;
  files: UserFile[];
  busy: boolean;
  onUpload: (list: FileList | null) => void;
  onRemove: (f: UserFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const has = files.length > 0;
  const cta = has && !multiple ? "Replace" : multiple ? "Add file" : "Upload";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</div>
          {hint && <div className="text-xs text-zinc-400">{hint}</div>}
        </div>
        {has && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
      </div>

      {has ? (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                {f.original_name}
                {f.size_bytes != null && <span className="text-zinc-400"> · {fmtSize(f.size_bytes)}</span>}
              </span>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" aria-label="View" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <Eye className="h-3.5 w-3.5" />
              </a>
              <a href={`/api/files/${f.id}?download=1`} aria-label="Download" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <Download className="h-3.5 w-3.5" />
              </a>
              <button type="button" onClick={() => onRemove(f)} aria-label="Delete" className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-zinc-400">Not uploaded yet.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={DOC_ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          onUpload(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        {busy ? "Uploading…" : cta}
      </button>
    </div>
  );
}
