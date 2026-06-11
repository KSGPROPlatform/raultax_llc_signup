import "server-only";
import { getPool, isDbConfigured, sql } from "./db";
import { roleFor, type Role } from "./role";

export type AppUser = {
  id: number | null;
  entra_object_id: string;
  email: string | null;
  name: string | null;
  tenant_id: string | null;
  role: Role;
  created_at: string | null;
  updated_at: string | null;
};

type Claims = {
  oid?: string;
  email?: string | null;
  name?: string | null;
  tid?: string | null;
};

// Called on sign-in: store/refresh the user's profile in raul_tax_users and
// return their role. New users default to 'user'. Falls back to the email
// allowlist when the DB isn't configured or is unreachable, so login never
// breaks because of the database.
export async function upsertUserAndGetRole(c: Claims): Promise<Role> {
  if (!c.oid || !isDbConfigured()) return roleFor(c.email);
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("oid", sql.NVarChar(64), c.oid)
      .input("email", sql.NVarChar(256), c.email ?? null)
      .input("name", sql.NVarChar(256), c.name ?? null)
      .input("tid", sql.NVarChar(64), c.tid ?? null)
      // Initial role for brand-new users comes from the allowlist; existing
      // rows keep whatever role the DB already holds (WHEN MATCHED leaves it).
      .input("defaultRole", sql.NVarChar(20), roleFor(c.email)).query(`
        MERGE raul_tax_users AS target
        USING (SELECT @oid AS entra_object_id) AS source
          ON target.entra_object_id = source.entra_object_id
        WHEN MATCHED THEN
          UPDATE SET email = @email, name = @name, tenant_id = @tid,
                     updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (entra_object_id, email, name, tenant_id, role, created_at, updated_at)
          VALUES (@oid, @email, @name, @tid, @defaultRole, SYSUTCDATETIME(), SYSUTCDATETIME())
        OUTPUT inserted.role;
      `);
    return (result.recordset[0]?.role as Role) ?? roleFor(c.email);
  } catch (err) {
    console.error("upsertUserAndGetRole failed:", err);
    return roleFor(c.email);
  }
}

// All users, for the admin table. Returns null when the DB isn't configured
// so the page can render mock rows instead.
export async function getAllUsers(): Promise<AppUser[] | null> {
  if (!isDbConfigured()) return null;
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id, entra_object_id, email, name, tenant_id, role, created_at, updated_at
      FROM raul_tax_users
      ORDER BY created_at DESC;
    `);
    return result.recordset as AppUser[];
  } catch (err) {
    console.error("getAllUsers failed:", err);
    return null;
  }
}

// A single user's stored record by Entra object id.
export async function getUserByOid(oid: string): Promise<AppUser | null> {
  if (!isDbConfigured()) return null;
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("oid", sql.NVarChar(64), oid).query(`
        SELECT id, entra_object_id, email, name, tenant_id, role, created_at, updated_at
        FROM raul_tax_users
        WHERE entra_object_id = @oid;
      `);
    return (result.recordset[0] as AppUser) ?? null;
  } catch (err) {
    console.error("getUserByOid failed:", err);
    return null;
  }
}
