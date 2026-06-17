"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { buttonClass, FormError } from "@/components/auth/AuthShell";
import {
  PersonalInfoForm,
  type PersonalInfoValues,
} from "@/components/profile/PersonalInfoForm";
import { DependentsSection } from "@/components/dashboard/DependentsSection";
import { BankSection } from "@/components/dashboard/BankSection";
import { CompaniesSection } from "@/components/dashboard/CompaniesSection";
import { DocumentVault } from "@/components/documents/DocumentVault";
import { postJson } from "@/lib/api";

const STEPS = [
  {
    title: "Personal info",
    subtitle: "Tell us about yourself so we can prepare your return.",
  },
  {
    title: "Your dependents",
    subtitle: "Add anyone you support. Skip if you have none.",
  },
  {
    title: "Bank information",
    subtitle: "Where your refund should be deposited.",
  },
  {
    title: "Your business",
    subtitle: "Tell us about any establishment you own.",
  },
  {
    title: "Documents",
    subtitle: "Upload your tax documents — or scan the QR to use your phone camera.",
  },
  {
    title: "You're all set",
    subtitle: "Finish to reach your dashboard — you can edit anything later.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [personal, setPersonal] = useState<Partial<PersonalInfoValues>>({});
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = STEPS.length - 1;

  // Step 0 "Continue" is the PersonalInfoForm's own submit button. Save to the
  // DB, remember the values (so re-visiting shows them), then advance.
  async function savePersonal(values: PersonalInfoValues) {
    setError(null);
    setSavingPersonal(true);
    const { ok, error } = await postJson("/api/profile/personal", values);
    setSavingPersonal(false);
    if (!ok) return setError(error);
    setPersonal(values);
    setStep((s) => Math.min(last, s + 1));
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

        {/* Progress */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Step {step + 1} of {STEPS.length}
          </p>
          {step < last && (
            <button
              type="button"
              onClick={() => {
                // Optional flow: just return to the dashboard WITHOUT marking
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
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {STEPS[step].title}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {STEPS[step].subtitle}
          </p>

          <div className="mt-6">
            {step === 0 && (
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
            {step === 1 && <DependentsSection />}
            {step === 2 && <BankSection />}
            {step === 3 && <CompaniesSection />}
            {step === 4 && <DocumentVault />}
            {step === 5 && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                Everything is saved as you go. Click{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Finish</span>{" "}
                to head to your dashboard, where you can review or update these
                details anytime.
              </div>
            )}
          </div>

          {/* Nav — the Personal info step (0) uses the form's own submit for
              "Continue", so we only render the generic footer there if a Back
              button is needed (it isn't on the first step). */}
          {step > 0 && (
            <div className="mt-8 flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < last ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(last, s + 1))}
                  className={`${buttonClass} flex flex-1 items-center justify-center gap-1.5`}
                >
                  Continue <ArrowRight className="h-4 w-4" />
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
      </div>
    </main>
  );
}
