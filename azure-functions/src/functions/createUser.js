const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// POST /api/createUser   body: { oid, email, name, tid }
// Upserts the user into raul_tax_users, keyed by the Entra object id (oid).
// New users default to role 'user'. Called by our Next.js app right after a
// successful Microsoft sign-in. Returns the saved row (including role).
app.http("createUser", {
  methods: ["POST"],
  authLevel: "function",
  route: "createUser",
  handler: async (request, context) => {
    try {
      const body = await request.json().catch(() => ({}));
      const { oid, email, name, tid } = body || {};

      if (!oid) {
        return { status: 400, jsonBody: { error: "oid is required" } };
      }

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("email", sql.NVarChar(256), email ?? null)
        .input("name", sql.NVarChar(256), name ?? null)
        .input("tid", sql.NVarChar(64), tid ?? null).query(`
          MERGE raul_tax_users AS target
          USING (SELECT @oid AS entra_object_id) AS source
            ON target.entra_object_id = source.entra_object_id
          WHEN MATCHED THEN
            UPDATE SET email = @email, name = @name, tenant_id = @tid,
                       updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (entra_object_id, email, name, tenant_id, role, created_at, updated_at)
            VALUES (@oid, @email, @name, @tid, 'user', SYSUTCDATETIME(), SYSUTCDATETIME())
          OUTPUT inserted.id, inserted.entra_object_id, inserted.email,
                 inserted.name, inserted.tenant_id, inserted.role,
                 inserted.created_at, inserted.updated_at;
        `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("createUser failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
