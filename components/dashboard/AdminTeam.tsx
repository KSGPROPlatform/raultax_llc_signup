"use client";

import { useEffect, useState } from "react";
import { UserPlus, ShieldCheck, Loader2, X, Copy, Mail } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type TeamUser = { entra_object_id: string; name: string | null; email: string | null };
type Invite = { email: string; created_at: string };

// Team management: the admin "creates" reviewer accounts by INVITING an email.
// If that email already has an account it becomes a reviewer immediately;
// otherwise it becomes one automatically at first sign-up (same login page —
// the password always stays with the person, in Entra).
export function AdminTeam() {
  const toast = useToast();
  const [reviewers, setReviewers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<string | null>(null);

  const inviteLink = (addr: string) =>
    `${window.location.origin}/signup?invite=${encodeURIComponent(addr)}`;

  function copyLink(addr: string) {
    navigator.clipboard
      .writeText(inviteLink(addr))
      .then(() => toast.success("Invite link copied — send it to them any way you like."))
      .catch(() => toast.error("Could not copy — long-press the link to copy manually."));
  }

  function emailLink(addr: string) {
    const subject = encodeURIComponent("You're invited to join raultax as a reviewer");
    const body = encodeURIComponent(
      `Hello,

You've been invited to join raultax as a tax-return reviewer.

Create your account here (use this same email address):
${inviteLink(addr)}

See you inside!`,
    );
    window.location.href = `mailto:${addr}?subject=${subject}&body=${body}`;
  }

  async function refresh() {
    try {
      const res = await fetch("/api/admin/team");
      if (res.ok) {
        const d = await res.json();
        setReviewers(d.reviewers ?? []);
        setInvites(d.invites ?? []);
      }
    } catch {
      /* keep current */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Could not invite the reviewer.");
        return;
      }
      toast.success(
        d.promoted
          ? `${email} is now a reviewer.`
          : `${email} invited — now send them their sign-up link below.`,
      );
      setLastInvite(d.promoted ? null : email);
      setEmail("");
      await refresh();
    } catch {
      toast.error("Network error — the invite wasn't sent.");
    } finally {
      setBusy(false);
    }
  }

  async function demote(u: TeamUser) {
    if (!confirm(`Remove the reviewer role from ${u.name || u.email}? Their assigned declarations stay assigned until you reassign them.`)) return;
    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oid: u.entra_object_id, role: "user" }),
    });
    if (res.ok) {
      toast.success(`${u.name || u.email} is a regular user again.`);
      await refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Could not change the role.");
    }
  }

  async function withdraw(inv: Invite) {
    const res = await fetch(`/api/admin/team?email=${encodeURIComponent(inv.email)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(`Invite for ${inv.email} withdrawn.`);
      setInvites((prev) => prev.filter((i) => i.email !== inv.email));
    } else toast.error("Could not withdraw the invite.");
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Review team</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Reviewers work under you: they see only the declarations you assign, and
        can adjust and approve them. Invite by email — they sign in through the
        normal login page with their own password.
      </p>

      <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="reviewer@example.com"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Invite reviewer
        </button>
      </form>

      {lastInvite && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3.5 dark:border-sky-500/25 dark:bg-sky-500/10">
          <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
            Invite created for <span className="font-semibold">{lastInvite}</span> — send them
            their account-creation link:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => emailLink(lastInvite)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
            >
              <Mail className="h-3.5 w-3.5" /> Send by email
            </button>
            <button
              type="button"
              onClick={() => copyLink(lastInvite)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-500/40 dark:text-sky-300"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ) : (
        <>
          {reviewers.length > 0 && (
            <ul className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800/60 dark:border-zinc-800">
              {reviewers.map((r) => (
                <li key={r.entra_object_id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                    <ShieldCheck className="h-3 w-3" /> Reviewer
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.name || "—"}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{r.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => demote(r)}
                    className="text-xs font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                  >
                    Remove role
                  </button>
                </li>
              ))}
            </ul>
          )}
          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Pending invites
              </p>
              <ul className="mt-2 space-y-1.5">
                {invites.map((inv) => (
                  <li key={inv.email} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                    <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                    <button type="button" onClick={() => emailLink(inv.email)} aria-label={`Email the invite link to ${inv.email}`} className="text-zinc-400 hover:text-sky-600">
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => copyLink(inv.email)} aria-label={`Copy the invite link for ${inv.email}`} className="text-zinc-400 hover:text-sky-600">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => withdraw(inv)} aria-label={`Withdraw invite for ${inv.email}`} className="text-zinc-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reviewers.length === 0 && invites.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No reviewers yet — invite the first one above.
            </p>
          )}
        </>
      )}
    </section>
  );
}
