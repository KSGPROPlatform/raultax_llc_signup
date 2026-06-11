import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInButton } from "@/components/SignInButton";

// Public welcome page. If the visitor is already signed in we send them
// straight to the dashboard; otherwise we show the "click to sign up" button,
// which hands off to Microsoft's hosted sign-up / sign-in page.
export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

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
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#13161d",
          border: "1px solid #232733",
          borderRadius: 12,
          padding: "2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.6rem" }}>Welcome</h1>
        <p style={{ margin: 0, color: "#8a92a6", fontSize: 15 }}>
          You need an account to view the dashboard. Microsoft handles sign-up,
          verification, and sign-in.
        </p>

        <SignInButton />
      </div>
    </main>
  );
}
