"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, FileText } from "lucide-react";
import type { UserFile } from "@/lib/files";
import { DOC_TYPES, OTHER_DOC, DOC_ACCEPT } from "@/lib/docTypes";

// Phone-side upload UI for /m/<token>. Authorised by the QR token (no login).
// Each slot lets the user snap a photo or pick a file; uploads sync to the
// account and show up on the web automatically.
export function MobileUpload({ token }: { token: string }) {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/uploads/mobile?token=${encodeURIComponent(token)}`);
      if (res.status === 401) return setExpired(true);
      if (res.ok) {
        const d = await res.json();
        setFiles(d.files ?? []);
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(docType: string | null, list: FileList | null) {
    if (!list || !list.length) return;
    setError(null);
    setBusyKey(docType ?? OTHER_DOC.key);
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("file", f);
        if (docType) fd.set("docType", docType);
        const res = await fetch("/api/uploads/mobile", { method: "POST", body: fd });
        if (res.status === 401) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || `Could not upload ${f.name}.`);
        }
      }
      await load();
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusyKey(null);
    }
  }

  if (expired) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">This link has expired</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Go back to your computer and tap <span className="font-medium">Show QR code</span> again to get a fresh link.
          </p>
        </div>
      </main>
    );
  }

  const known = new Set(DOC_TYPES.map((d) => d.key));
  const otherFiles = files.filter((f) => !f.doc_type || !known.has(f.doc_type));

  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-base font-bold text-zinc-950">r</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">raultax</span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">Upload your documents</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Snap a photo or pick a file for each item. They sync to your account automatically — finish up on your computer.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-2.5">
          {DOC_TYPES.map((d) => (
            <MobileSlot
              key={d.key}
              label={d.label}
              hint={d.hint}
              count={files.filter((f) => f.doc_type === d.key).length}
              busy={busyKey === d.key}
              multiple={d.multiple}
              onUpload={(list) => upload(d.key, list)}
            />
          ))}
          <MobileSlot
            label={OTHER_DOC.label}
            count={otherFiles.length}
            busy={busyKey === OTHER_DOC.key}
            multiple
            onUpload={(list) => upload(null, list)}
          />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">Secured · uploads are private to your account.</p>
      </div>
    </main>
  );
}

function MobileSlot({
  label,
  hint,
  count,
  busy,
  multiple,
  onUpload,
}: {
  label: string;
  hint?: string;
  count: number;
  busy: boolean;
  multiple: boolean;
  onUpload: (list: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const has = count > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          has ? "bg-emerald-100 text-emerald-600" : "bg-zinc-100 text-zinc-500"
        }`}
      >
        {has ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-900">{label}</div>
        <div className="truncate text-xs text-zinc-400">
          {has ? `${count} uploaded${multiple ? " · add more" : ""}` : hint || "Not uploaded"}
        </div>
      </div>
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
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {has && !multiple ? "Replace" : "Add"}
      </button>
    </div>
  );
}
