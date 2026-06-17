"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";

type Props = {
  onboardingComplete: boolean;
  personalInfoDone: boolean;
  ownsEstablishment: boolean;
};

type Counts = { bank: number; companies: number; dependents: number; files: number };

// Dashboard "Complete your profile" experience. Onboarding is now optional and
// invited from here: we always show a persistent inline progress card, and —
// while onboarding isn't finished — a one-time popup modal nudging the user in.
export function ProfileChecklist({
  onboardingComplete,
  personalInfoDone,
  ownsEstablishment,
}: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);
  // The popup is shown once per page load; "Maybe later" dismisses it for the
  // session while leaving the inline card visible. Never shown once complete.
  const [showModal, setShowModal] = useState(!onboardingComplete);

  useEffect(() => {
    let active = true;
    (async () => {
      const get = (url: string): Promise<Record<string, unknown>> =>
        fetch(url)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
      const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
      const [b, c, d, f] = await Promise.all([
        get("/api/bank-accounts"),
        get("/api/companies"),
        get("/api/dependents"),
        get("/api/files"),
      ]);
      if (active) {
        setCounts({
          bank: len(b.rows),
          companies: len(c.rows),
          dependents: len(d.rows),
          files: len(f.files),
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Wait for the counts before rendering so the progress bar isn't misleading.
  if (!counts) return null;

  const items = [
    { label: "Personal information", done: personalInfoDone },
    { label: "Bank information", done: counts.bank > 0 },
    {
      // Business owners must add a company; otherwise the section is N/A and
      // counts as done (same heuristic as before).
      label: ownsEstablishment ? "Company details" : "Business details",
      done: !ownsEstablishment || counts.companies > 0,
    },
    { label: "Documents", done: counts.files > 0 },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  // Finished the onboarding journey: show a subtle "complete" state, no popup.
  if (onboardingComplete) {
    return (
      <section className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> Your profile is complete.
      </section>
    );
  }

  const ProgressBar = (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-500/20">
      <div
        className="h-full rounded-full bg-amber-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  return (
    <>
      {/* Persistent inline progress card */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Complete your profile
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {doneCount} of {items.length} sections complete · {pct}%
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            Continue setup <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-3">{ProgressBar}</div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-xs">
              {i.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
              )}
              <span
                className={
                  i.done
                    ? "text-zinc-700 dark:text-zinc-300"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                {i.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* One-time popup nudge — dismissible, inline card stays either way */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="grid h-11 w-11 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3
              id="profile-modal-title"
              className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Complete your profile
            </h3>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              You&apos;re {pct}% there. Add your details so we can prepare your
              filings — it only takes a few minutes.
            </p>

            <div className="mt-4">{ProgressBar}</div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <Link
                href="/onboarding"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
