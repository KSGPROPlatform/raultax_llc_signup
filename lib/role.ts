// Role is normally read from raul_tax_users.role in the database. This list is
// the fallback used (a) before the DB is configured/reachable, and (b) as the
// default when deciding a brand-new user's role. Add admin emails here.
const ADMIN_EMAILS = ["petzyrockchendi@gmail.com"];

export type Role = "admin" | "user";

export function roleFor(email?: string | null): Role {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return "admin";
  return "user";
}
