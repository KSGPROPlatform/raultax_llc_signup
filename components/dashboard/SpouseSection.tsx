"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Spouse } from "@/lib/profileData";
import { SpouseForm, type SpouseValues } from "@/components/profile/SpouseForm";
import { SectionError, SectionSkeleton } from "@/components/dashboard/sectionUI";

// Spouse manager (one per user) — used in the onboarding step and the dashboard.
// `mode` is decided by the filing status: "full" (Married filing jointly) or
// "ssn" (Married filing separately).
export function SpouseSection({ mode }: { mode: "full" | "ssn" }) {
  const [initial, setInitial] = useState<Partial<SpouseValues> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/spouse");
        if (res.ok) {
          const data = await res.json();
          const s = (data.spouse ?? {}) as Partial<Spouse>;
          if (active) {
            setInitial({
              first_name: s.first_name ?? "",
              last_name: s.last_name ?? "",
              date_of_birth: s.date_of_birth ?? "",
              ssn: s.ssn ?? "",
              street_address: s.street_address ?? "",
              city: s.city ?? "",
              state_province: s.state_province ?? "",
              postal_code: s.postal_code ?? "",
            });
          }
        } else if (active) {
          setInitial({});
        }
      } catch {
        if (active) setInitial({});
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function save(v: Partial<SpouseValues>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/spouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the spouse.");
        return;
      }
      setInitial((prev) => ({ ...prev, ...v }));
      setSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || initial === null) return <SectionSkeleton />;

  return (
    <div className="space-y-4">
      {error && <SectionError message={error} />}
      {saved && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Spouse details saved.
        </p>
      )}
      <SpouseForm
        mode={mode}
        initial={initial}
        busy={busy}
        onSubmit={save}
        submitLabel={saved ? "Update spouse" : "Save spouse"}
      />
    </div>
  );
}
