// Runs once when the Node server starts (Next.js instrumentation hook).
//
// This network has a broken IPv6 path: Node's global fetch (undici) races
// IPv6 via Happy-Eyeballs and stalls (ETIMEDOUT) on the POST to Microsoft's
// token endpoint during sign-in, even though IPv4 (curl) works fine. Forcing
// IPv4 and disabling family auto-selection makes outbound fetches reliable.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");

    const net = await import("node:net");
    (net.setDefaultAutoSelectFamily as ((value: boolean) => void) | undefined)?.(
      false,
    );
  }
}
