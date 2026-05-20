"use client";

import { useState, FormEvent } from "react";

const LOGIN_URL = "https://example.com/api/login";

type Status =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; data: unknown }
  | { state: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ state: "submitting" });

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : await res.text();

      if (!res.ok) {
        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message: unknown }).message)
            : `Request failed with status ${res.status}`;
        setStatus({ state: "error", message });
        return;
      }

      setStatus({ state: "success", data });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  const submitting = status.state === "submitting";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#0b0d12",
        color: "#e6e8ee",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#13161d",
          border: "1px solid #232733",
          borderRadius: 12,
          padding: "1.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <header style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Sign in</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#8a92a6", fontSize: 14 }}>
            Posting to <code>{LOGIN_URL}</code>
          </p>
        </header>

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Username"
          type="text"
          value={username}
          onChange={setUsername}
          autoComplete="username"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: "0.5rem",
            padding: "0.7rem 1rem",
            borderRadius: 8,
            border: "none",
            background: submitting ? "#2a3147" : "#4f7cff",
            color: "white",
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {status.state === "error" && (
          <p style={{ margin: 0, color: "#ff7a7a", fontSize: 14 }}>
            {status.message}
          </p>
        )}
        {status.state === "success" && (
          <pre
            style={{
              margin: 0,
              padding: "0.75rem",
              background: "#0b0d12",
              border: "1px solid #232733",
              borderRadius: 8,
              fontSize: 12,
              color: "#9be39b",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(status.data, null, 2)}
          </pre>
        )}
      </form>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type: "email" | "text" | "password";
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#a9b0c2" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        style={{
          padding: "0.6rem 0.75rem",
          borderRadius: 8,
          border: "1px solid #2a3040",
          background: "#0b0d12",
          color: "#e6e8ee",
          fontSize: 14,
          outline: "none",
        }}
      />
    </label>
  );
}
