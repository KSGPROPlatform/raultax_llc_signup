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
  Sparkles,
  ChevronDown,
  X,
} from "lucide-react";
import type { UserFile, Extraction } from "@/lib/files";
import { DOC_ACCEPT, isExtractable } from "@/lib/docTypes";
import { maskTail } from "@/components/profile/mask";

type Qr = { url: string; qrDataUrl: string; expiresInSec: number };
type AnalyzeState = "idle" | "reading" | "done" | "unsupported" | "error";

// Fields we never render in the clear even in the little preview.
const SENSITIVE = /ssn|tin|account|routing/i;

function parseFields(ex: Extraction | null): Record<string, unknown> | null {
  if (!ex) return null;
  if (ex.fields) return ex.fields;
  if (ex.fields_json) {
    try {
      return JSON.parse(ex.fields_json);
    } catch {
      return null;
    }
  }
  return null;
}

function renderVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

// One inline document slot: shows the current file (view/download/remove) or an
// uploader, plus a "Use phone" button that shows a QR so the exact document can
// be captured on a phone. After a file lands, high-value docs (W-2, 1099, ID,
// SSN) are read by Azure Document Intelligence and the fields are saved.
export function DocUpload({
  docType,
  jobId,
  label,
  accept = DOC_ACCEPT,
}: {
  docType: string;
  jobId?: number;
  label: string;
  accept?: string;
}) {
  const [file, setFile] = useState<UserFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [analyze, setAnalyze] = useState<AnalyzeState>("idle");
  const [fields, setFields] = useState<Record<string, unknown> | null>(null);
  const [showFields, setShowFields] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const extractable = isExtractable(docType);

  const refresh = useCallback(async (): Promise<UserFile | null> => {
    try {
      const res = await fetch("/api/files");
      if (res.ok) {
        const data = await res.json();
        const files: UserFile[] = data.files ?? [];
        const match =
          files.find(
            (f) => f.doc_type === docType && (f.job_id ?? null) === (jobId ?? null),
          ) ?? null;
        setFile(match);
        return match;
      }
    } catch {
      /* keep current */
    }
    return null;
  }, [docType, jobId]);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // While the QR is open, poll so a phone upload shows up automatically.
  useEffect(() => {
    if (!qr) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [qr, refresh]);

  const runAnalyze = useCallback(async (fileId: number) => {
    setAnalyze("reading");
    try {
      const res = await fetch(`/api/files/${fileId}/analyze`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      const ex = d.extraction as Extraction | null;
      if (res.ok && ex) {
        setAnalyze(ex.status === "done" ? "done" : ex.status === "unsupported" ? "unsupported" : "error");
        setFields(parseFields(ex));
      } else {
        setAnalyze("error");
      }
    } catch {
      setAnalyze("error");
    }
  }, []);

  // When a file lands (upload, replace, or phone upload) show the stored
  // extraction if any, otherwise kick one off. Keyed on the file id so it runs
  // exactly once per file and never loops on an error.
  useEffect(() => {
    if (!file || !extractable) {
      setAnalyze(file ? "unsupported" : "idle");
      return;
    }
    let active = true;
    (async () => {
      try {
        const g = await fetch(`/api/files/${file.id}/analyze`);
        const d = g.ok ? await g.json() : {};
        const ex = (d.extraction ?? null) as Extraction | null;
        if (!active) return;
        if (ex && ex.status && ex.status !== "pending") {
          setAnalyze(ex.status === "done" ? "done" : ex.status === "unsupported" ? "unsupported" : "error");
          setFields(parseFields(ex));
          return;
        }
        await runAnalyze(file.id);
      } catch {
        if (active) setAnalyze("error");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, extractable, runAnalyze]);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", list[0]);
      fd.set("docType", docType);
      if (jobId != null) fd.set("jobId", String(jobId));
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Upload failed.");
      } else {
        setFields(null);
        setShowFields(false);
        await refresh();
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!file || !confirm(`Remove ${label}?`)) return;
    const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    if (res.ok) {
      setFile(null);
      setFields(null);
      setAnalyze("idle");
    } else setError("Could not remove the file.");
  }

  async function openPhone() {
    setQrLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ docType, label, origin: window.location.origin });
      if (jobId != null) q.set("jobId", String(jobId));
      const res = await fetch(`/api/uploads/handoff?${q.toString()}`);
      if (res.ok) setQr(await res.json());
      else setError("Could not start the phone upload.");
    } catch {
      setError("Could not start the phone upload.");
    } finally {
      setQrLoading(false);
    }
  }

  const previewEntries = fields
    ? Object.entries(fields).filter(
        ([k, v]) => !k.startsWith("__") && k !== "text" && v != null && v !== "",
      )
    : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
            file
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          {file ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</div>
          <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {loading ? "…" : file ? file.original_name : "Not uploaded yet"}
          </div>
        </div>
        {file && (
          <>
            <a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" aria-label="View" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <Eye className="h-4 w-4" />
            </a>
            <a href={`/api/files/${file.id}?download=1`} aria-label="Download" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <Download className="h-4 w-4" />
            </a>
            <button type="button" onClick={remove} aria-label="Remove" className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Document Intelligence status (only for the extractable, uploaded docs) */}
      {file && extractable && analyze === "reading" && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your document…
        </p>
      )}
      {file && analyze === "error" && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          We couldn&apos;t read this document automatically — it&apos;s still saved.
        </p>
      )}
      {file && analyze === "done" && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowFields((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            <Sparkles className="h-3.5 w-3.5" /> Details captured
            {previewEntries.length > 0 && (
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFields ? "rotate-180" : ""}`} />
            )}
          </button>
          {showFields && previewEntries.length > 0 && (
            <dl className="mt-2 grid gap-1 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900/50">
              {previewEntries.slice(0, 12).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="shrink-0 text-zinc-500 dark:text-zinc-400">{k}</dt>
                  <dd className="min-w-0 flex-1 truncate text-right font-medium text-zinc-800 dark:text-zinc-200">
                    {SENSITIVE.test(k) ? maskTail(String(v)) : renderVal(v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
          {busy ? "Uploading…" : file ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          disabled={qrLoading}
          onClick={() => (qr ? setQr(null) : openPhone())}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {qr ? <X className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
          {qr ? "Close" : qrLoading ? "…" : "Use phone"}
        </button>
      </div>

      {qr && (
        <div className="mt-3 flex flex-col items-center gap-1.5 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qrDataUrl} alt="QR code to upload from your phone" className="h-40 w-40 rounded bg-white p-1.5" />
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
            Scan with your phone to upload <span className="font-medium">{label}</span> — it appears here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
