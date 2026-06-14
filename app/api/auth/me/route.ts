import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/auth/me — the current user, or 401 if not signed in.
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
