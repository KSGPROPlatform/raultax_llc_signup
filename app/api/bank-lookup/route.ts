import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/bank-lookup?routing=XXXXXXXXX — resolve a US routing number to its
// bank name via a free public lookup. Server-side (avoids CORS, keeps it
// controlled). Routing numbers are PUBLIC (printed on every check); the account
// number is never involved here. Always returns { bankName: string | null }.

// ABA checksum — cheap validity check so we don't call out on obvious junk.
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

  try {
    const res = await fetch(
      `https://www.routingnumbers.com/api/name.json?rn=${routing}`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ bankName: null });
    const data = (await res.json().catch(() => ({}))) as {
      code?: number;
      name?: string;
    };
    const bankName = data?.code === 200 && data?.name ? String(data.name) : null;
    return NextResponse.json({ bankName });
  } catch {
    return NextResponse.json({ bankName: null });
  }
}
