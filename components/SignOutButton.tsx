"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";

// Full (federated) sign-out: clear the app session, then end Microsoft's SSO
// session and return to the welcome page. Compact button for the topbar.
export function SignOutButton({ logoutUrl }: { logoutUrl?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await signOut({ redirect: false });
      if (logoutUrl) {
        const postLogout = `${window.location.origin}/`;
        window.location.href = `${logoutUrl}?post_logout_redirect_uri=${encodeURIComponent(
          postLogout,
        )}`;
      } else {
        window.location.href = "/";
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border disabled:cursor-wait disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {loading ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
