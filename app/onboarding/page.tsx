"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { buttonClass, FormError } from "@/components/auth/AuthShell";
import {
  PersonalInfoForm,
  type PersonalInfoValues,
} from "@/components/profile/PersonalInfoForm";
import { SpouseSection } from "@/components/dashboard/SpouseSection";
import { SelectField } from "@/components/forms/Field";
import { allowedTaxYears } from "@/lib/taxYear";
import { DependentsSection } from "@/components/dashboard/DependentsSection";
import { BankSection } from "@/components/dashboard/BankSection";
import { CompaniesSection } from "@/components/dashboard/CompaniesSection";
import { JobsSection } from "@/components/dashboard/JobsSection";
import { postJson } from "@/lib/api";

type StepKey =
  | "year"
  | "personal"
  | "spouse"
  | "dependents"
  | "bank"
  | "jobs"
  | "business"
  | "finish";

const META: Record<StepKey, { title: string; subtitle: string }> = {
  year: {
    title: "Tax year",
    subtitle: "Which year are you declaring taxes for?",
  },
  personal: {
    title: "Personal info",
    subtitle: "Tell us about yourself so we can prepare your return.",
  },
  spouse: {
    title: "Spouse information",
    subtitle: "Details for the person you file with.",
  },
  dependents: {
    title: "Your dependents",
    subtitle: "Add anyone you support. Skip if you have none.",
  },
  bank: {
    title: "Bank information",
    subtitle: "Where your refund should be deposited.",
  },
  jobs: { title: "Jobs", subtitle: "Add each job and upload its W-2 and 1099." },
  business: {
    title: "Your business",
    subtitle: "Tell us about any establishment you own.",
  },
  finish: {
    title: "You're all set",
    subtitle: "Finish to reach your dashboard — you can edit anything later.",
  },
};

// The journey starts by picking the TAX YEAR being declared (the filing's
// primary attribute — all documents are stamped with it), then branches on the
// Form-1 filing status:
//   Single                    -> no spouse, no dependents
//   Married filing jointly    -> full spouse step + dependents
//   Married filing separately -> spouse SSN-only step + dependents
//   Head of household         -> dependents (no spouse)
function buildSteps(filingStatus: string): StepKey[] {
  const needsSpouse =
    filingStatus === "Married filing jointly" ||
    filingStatus === "Married filing separately";
  const needsDependents = filingStatus !== "Single";
  return [
    "year",
    "personal",
    ...(needsSpouse ? (["spouse"] as StepKey[]) : []),
    ...(needsDependents ? (["dependents"] as StepKey[]) : []),
    "bank",
    "jobs",
    "business",
    "finish",
  ];
}
const spouseModeFor = (fs: string): "full" | "ssn" =>
  fs === "Married filing jointly" ? "full" : "ssn";

function OnboardingFlow() {
  const router = useRouter();
  // "?new=1" = the dashboard's "Declare tax" button: always open on the
  // year-selection step, with already-started years disabled.
  const isNew = useSearchParams().get("new") === "1";
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [personal, setPersonal] = useState<Partial<PersonalInfoValues>>({});
  const [savingPersonal, setSavingPersonal] = useState(false);
  // Nothing renders until the saved year + resume position have loaded, so the
  // stepper never flashes the default year / first step before jumping.
  const [loaded, setLoaded] = useState(false);
  const [taxYear, setTaxYear] = useState<number>(allowedTaxYears()[0]);
  const [savingYear, setSavingYear] = useState(false);
  const [startedYears, setStartedYears] = useState<number[]>([]);
  const [hasData, setHasData] = useState<Partial<Record<StepKey, boolean>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fs = personal.filing_status ?? "";
  const steps = useMemo(() => buildSteps(fs), [fs]);
  const spouseMode = spouseModeFor(fs);
  const last = steps.length - 1;
  const safeStep = Math.min(step, last);
  const currentKey = steps[safeStep];

  // Keep the index valid if the active steps shrink (e.g. switching to Single
  // drops the dependents step).
  useEffect(() => {
    if (step > last) setStep(last);
  }, [step, last]);

  // On load: pre-fill Personal info AND resume at the next unfinished step (per
  // the filing-status-aware step list), reading the DB so it works across devices.
  useEffect(() => {
    let active = true;
    (async () => {
      const get = (url: string): Promise<Record<string, unknown>> =>
        fetch(url)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
      const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
      const [decl, pf, sp, dep, bank, jobs, co] = await Promise.all([
        get("/api/declarations"),
        get("/api/profile/personal"),
        get("/api/spouse"),
        get("/api/dependents"),
        get("/api/bank-accounts"),
        get("/api/jobs"),
        get("/api/companies"),
      ]);
      if (!active) return;
      const started = (Array.isArray(decl.rows) ? (decl.rows as { tax_year: number }[]) : [])
        .map((r) => r.tax_year);
      setStartedYears(started);
      if (isNew) {
        // Declaring a NEW year: preselect the first year not started yet.
        const fresh = allowedTaxYears().find((y) => !started.includes(y));
        if (fresh) setTaxYear(fresh);
      } else if (typeof decl.selectedYear === "number") {
        setTaxYear(decl.selectedYear);
      }
      const profile = (pf.profile ?? {}) as Partial<PersonalInfoValues>;
      if (pf.profile) setPersonal(profile);
      const localSteps = buildSteps(profile.filing_status ?? "");
      const spouse = (sp.spouse ?? null) as Record<string, string> | null;
      const has: Record<StepKey, boolean> = {
        year: len(decl.rows) > 0,
        personal: Boolean((profile.date_of_birth ?? "").trim()),
        spouse: Boolean(
          spouse &&
            ((spouse.ssn ?? "").trim() || (spouse.first_name ?? "").trim()),
        ),
        dependents: len(dep.rows) > 0,
        bank: len(bank.rows) > 0,
        jobs: len(jobs.rows) > 0,
        business: len(co.rows) > 0,
        finish: false,
      };
      setHasData(has);
      let furthest = -1;
      localSteps.forEach((k, i) => {
        if (has[k]) furthest = i;
      });
      // The tax year is mandatory and comes first: until a declaration exists,
      // always land on the year step (even if older data was saved before the
      // per-year feature). Once declared, resume past the furthest saved step —
      // EXCEPT when declaring a new year (?new=1), which always starts at the
      // year step.
      if (!isNew && has.year && furthest >= 0) {
        setStep(Math.min(furthest + 1, localSteps.length - 1));
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Step "personal" Continue is the PersonalInfoForm's own submit. Save, remember
  // the values (which re-derives the step list from the new filing status), advance.
  async function savePersonal(values: PersonalInfoValues) {
    setError(null);
    setSavingPersonal(true);
    const { ok, error } = await postJson("/api/profile/personal", values);
    setSavingPersonal(false);
    if (!ok) return setError(error);
    setPersonal(values);
    const localSteps = buildSteps(values.filing_status ?? "");
    // Declaring a new year with everything pre-filled: after confirming the
    // personal info, jump straight to where the user's progress had reached
    // instead of stepping through every already-completed form.
    if (isNew && hasData) {
      const snapshot = { ...hasData, year: true, personal: true };
      let furthest = -1;
      localSteps.forEach((k, i) => {
        if (snapshot[k]) furthest = i;
      });
      setStep(Math.min(furthest + 1, localSteps.length - 1));
      return;
    }
    setStep((s) => Math.min(localSteps.length - 1, s + 1));
  }

  // Step 0 Continue: start (or re-open) the chosen year's declaration — every
  // document uploaded afterwards is stamped with it — then advance.
  async function saveYear() {
    setError(null);
    setSavingYear(true);
    try {
      const res = await fetch("/api/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not start the declaration.");
        return;
      }
      setStep((s) => Math.min(last, s + 1));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingYear(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      /* even if this fails, send them on — the dashboard nudge will remain */
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-xl">
        {/* Brand */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-base font-bold text-zinc-950">
            r
          </span>
          <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            raultax
          </span>
        </div>

        {!loaded ? (
          <div className="grid place-items-center rounded-2xl border border-zinc-200 bg-white py-20 text-zinc-400 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
        {/* Progress */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Step {safeStep + 1} of {steps.length}
          </p>
          {safeStep < last && (
            <button
              type="button"
              onClick={() => {
                // Optional flow: return to the dashboard WITHOUT marking
                // onboarding complete, so the "complete your profile" nudge stays.
                router.push("/dashboard");
                router.refresh();
              }}
              className="text-xs font-medium text-zinc-500 hover:underline dark:text-zinc-400"
            >
              Skip for now
            </button>
          )}
        </div>
        <div className="mb-6 flex gap-1.5">
          {steps.map((k, i) => (
            <span
              key={k}
              className={`h-1 flex-1 rounded-full ${
                i <= safeStep ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {META[currentKey].title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {META[currentKey].subtitle}
          </p>

          <div className="mt-6">
            {currentKey === "year" && (
              <div className="space-y-4">
                <FormError message={error} />
                <SelectField
                  id="ob_tax_year"
                  label="Tax year"
                  required
                  value={String(taxYear)}
                  onChange={(e) => setTaxYear(Number(e.target.value))}
                  options={allowedTaxYears().map(String)}
                  disabledOptions={startedYears
                    .filter((y) => y !== taxYear)
                    .map(String)}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Your documents (W-2s, 1099s) must be for this year — you can
                  declare another year later from your dashboard.
                </p>
              </div>
            )}
            {currentKey === "personal" && (
              <>
                <div className="mb-4">
                  <FormError message={error} />
                </div>
                <PersonalInfoForm
                  initial={personal}
                  busy={savingPersonal}
                  submitLabel="Save & continue"
                  onSubmit={savePersonal}
                />
              </>
            )}
            {currentKey === "spouse" && <SpouseSection mode={spouseMode} />}
            {currentKey === "dependents" && <DependentsSection />}
            {currentKey === "bank" && <BankSection />}
            {currentKey === "jobs" && <JobsSection />}
            {currentKey === "business" && <CompaniesSection />}
            {currentKey === "finish" && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                Everything is saved as you go. Click{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  Finish
                </span>{" "}
                to head to your dashboard, where you can review or update these
                details anytime.
              </div>
            )}
          </div>

          {/* The Personal info step's Continue is the form's own submit, so it
              only needs a Back (to the tax-year step) here. */}
          {currentKey === "personal" && safeStep > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            </div>
          )}

          {/* Nav — the Personal info step uses the form's own submit for
              "Continue", so the generic footer renders for every other step. */}
          {currentKey !== "personal" && (
            <div className="mt-8 flex gap-2">
              {safeStep > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {safeStep < last ? (
                <button
                  type="button"
                  disabled={savingYear}
                  onClick={() =>
                    currentKey === "year"
                      ? saveYear()
                      : setStep((s) => Math.min(last, s + 1))
                  }
                  className={`${buttonClass} flex flex-1 items-center justify-center gap-1.5`}
                >
                  {savingYear ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  disabled={finishing}
                  className={`${buttonClass} flex flex-1 items-center justify-center gap-1.5`}
                >
                  {finishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Finishing…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Finish
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
          </>
        )}
      </div>
    </main>
  );
}

// useSearchParams requires a Suspense boundary at the page level.
export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  );
}
