import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listBankAccounts, saveBankAccount } from "@/lib/profileData";

// GET /api/bank-accounts — the signed-in user's bank accounts.
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listBankAccounts(user.sub);
  return NextResponse.json({ rows });
}

// POST /api/bank-accounts — create (no id) or update (with id) one account.
export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    const row = await saveBankAccount(user.sub, {
      id: body.id,
      bank_name: body.bank_name ?? "",
      account_number: body.account_number ?? "",
      routing_number: body.routing_number ?? "",
    });
    return NextResponse.json({ row }, { status: body.id ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
