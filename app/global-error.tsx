"use client";

// Last-resort boundary for errors thrown in the root layout itself. It must
// render its own <html>/<body> because it replaces the root layout.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#a1a1aa" }}>
            The app hit an unexpected error.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#fafafa",
              color: "#09090b",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
