import "server-only";

// Server-side client for the calc1040 Azure Function (the 1040 computation
// engine). Same base/key + X-App-Id pattern as lib/files.ts.
const base = process.env.PROFILE_API_URL;
const key = process.env.PROFILE_API_KEY;
const APP_HEADERS = { "X-App-Id": "raultax" };

function fnUrl(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${(base ?? "").replace(/\/$/, "")}/${path}`);
  if (key) url.searchParams.set("code", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export type TaxReturnRow = Record<string, unknown> & {
  flags?: string[];
  overrides?: Record<string, unknown>;
  frozen?: boolean;
};

// The stored 1040 row for (user, year), or null.
export async function getTaxReturn(oid: string, taxYear: number): Promise<TaxReturnRow | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("calc1040", { oid, taxYear }), {
      headers: APP_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return (await res.json()) as TaxReturnRow | null;
  } catch (err) {
    console.error("getTaxReturn failed:", err);
    return null;
  }
}

// Recompute the (user, year) return from current data; respects freeze.
export async function computeTaxReturn(oid: string, taxYear: number): Promise<TaxReturnRow | null> {
  if (!base) return null;
  try {
    const res = await fetch(fnUrl("calc1040", { oid, taxYear }), {
      method: "POST",
      headers: APP_HEADERS,
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    return (await res.json()) as TaxReturnRow;
  } catch (err) {
    console.error("computeTaxReturn failed:", err);
    return null;
  }
}
