import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure Static Web Apps hybrid Next.js caps the app at 250 MB; `standalone`
  // emits only what the server needs, keeping us under the limit.
  output: "standalone",
};

export default nextConfig;
