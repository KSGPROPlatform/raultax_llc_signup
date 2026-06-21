import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROUTING } from "@/lib/routingNumbers";

// GET /api/bank-lookup?routing=XXXXXXXXX — resolve a US routing number to its
// bank name. Resolved against the BUNDLED Federal Reserve FedACH directory
// (public domain) — no external call, so it works reliably offline. Routing
// numbers are public; the account number is never involved here.
// Always returns { bankName: string | null }.

// ABA checksum — quick validity guard before the lookup.
function isValidAba(r: string): boolean {
  if (!/^\d{9}$/.test(r)) return false;
  const d = r.split("").map(Number);
  const sum =
    3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const routing = (new URL(request.url).searchParams.get("routing") || "").replace(
    /\D/g,
    "",
  );
  if (!isValidAba(routing)) return NextResponse.json({ bankName: null });

  return NextResponse.json({ bankName: ROUTING[routing] ?? null });
}
