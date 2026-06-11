/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the SQL driver out of the bundle; it must run only on the Node server.
  serverExternalPackages: ["mssql"],
};

export default nextConfig;
