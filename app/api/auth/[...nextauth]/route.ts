import { handlers } from "@/auth";

// Microsoft redirects back to /api/auth/callback/microsoft-entra-id,
// which is served by these handlers. You never call this route directly.
export const { GET, POST } = handlers;
