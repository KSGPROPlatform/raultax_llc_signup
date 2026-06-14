// Runs once when the Node server starts (Next.js instrumentation hook).
//
// Node's global fetch (undici) races IPv6 via Happy-Eyeballs and can stall/fail
// (ETIMEDOUT / ENETUNREACH) on outbound HTTPS to some Azure hosts — surfacing as
// "TypeError: fetch failed". This broke the server-to-server call to the Azure
// Function. Forcing IPv4 and disabling family auto-selection makes outbound
// fetches reliable. (Same fix the project used before the rebuild.)
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
