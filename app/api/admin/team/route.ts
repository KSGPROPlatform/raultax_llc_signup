import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAdminOverview,
  inviteReviewer,
  listReviewerInvites,
  setUserRole,
  withdrawInvite,
} from "@/lib/admin";
import { validateEmail } from "@/lib/validation";

// Admin team management: reviewers work UNDER the admin.
//   GET    -> { reviewers, users, invites }
//   POST   { email }        -> invite (auto-promotes an existing account)
//   PATCH  { oid, role }    -> user <-> reviewer ('admin' is SQL-only)
//   DELETE ?email=          -> withdraw a pending invite

async function adminSession() {
  const user = await getSession();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const [users, invites] = await Promise.all([getAdminOverview(), listReviewerInvites()]);
  return NextResponse.json({
    reviewers: users.filter((u) => u.role === "reviewer"),
    users: users.filter((u) => u.role === "user"),
    invites,
  });
}

export async function POST(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const emailErr = validateEmail(email);
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });
  const result = await inviteReviewer(email, s.user.sub);
  if (!result) return NextResponse.json({ error: "Could not invite the reviewer." }, { status: 502 });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const body = await request.json().catch(() => ({}));
  const oid = String(body.oid ?? "");
  const role = body.role === "reviewer" ? "reviewer" : body.role === "user" ? "user" : null;
  if (!oid || !role) {
    return NextResponse.json({ error: "oid and role (user|reviewer) are required." }, { status: 400 });
  }
  const result = await setUserRole(oid, role);
  if (!result?.ok) return NextResponse.json({ error: "Could not change the role." }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const s = await adminSession();
  if ("error" in s) return s.error;
  const email = new URL(request.url).searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "email is required." }, { status: 400 });
  await withdrawInvite(email);
  return NextResponse.json({ ok: true });
}
