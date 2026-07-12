"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Loader2, FileUp } from "lucide-react";

// Phone-side uploader for /m/<token>. The token already encodes WHICH document
// (and job) this is for, so the phone just snaps/picks a file and it lands in
// the right slot. No login.
export function MobileUpload({ token, label }: { token: string; label: string }) {
  const [uploaded, setUploaded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("file", f);
        const res = await fetch("/api/uploads/mobile", { method: "POST", body: fd });
        if (res.status === 401) {
          setExpired(true);
          return;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || `Could not upload ${f.name}.`);
        } else {
          setUploaded((n) => n + 1);
        }
      }
    } catch {
      setError("Network error during upload.");
    } finally {
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">This link has expired</h1>
          <p className="mt-2 text-sm text-zinc-500">
            On your computer, tap <span className="font-medium">Use phone</span> again to get a fresh link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-base font-bold text-zinc-950">r</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">raultax</span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">Upload {label}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Take a photo or pick a file. It syncs to your account automatically — then finish up on your computer.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {uploaded > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Uploaded — you can close this page.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {/* Camera first — the fast path on a phone. capture="environment"
              opens the rear camera directly. */}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-4 text-base font-semibold text-zinc-950 transition-colors hover:bg-amber-400">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            {busy ? "Uploading…" : "Take a photo"}
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-4 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-100">
            <input
              type="file"
              accept="image/*,application/pdf"
              hidden
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
            <FileUp className="h-5 w-5" /> Choose a file
          </label>
        </div>
      </div>
    </main>
  );
}
