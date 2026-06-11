"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Spinner } from "./Spinner";

// Kicks off sign-in from the client. next-auth/react's signIn() does a real
// window.location redirect to Microsoft's hosted page, which (unlike a server
// action redirecting to an external URL) navigates reliably. On success the
// page leaves for Microsoft; only on failure do we reset the loading state.
export function SignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        width: "100%",
        marginTop: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: 8,
        border: "none",
        background: loading ? "#3a5bd0" : "#4f7cff",
        color: "white",
        fontWeight: 600,
        fontSize: 15,
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {loading ? (
        <>
          <Spinner />
          Redirecting to Microsoft…
        </>
      ) : (
        "Click to sign up / sign in"
      )}
    </button>
  );
}
