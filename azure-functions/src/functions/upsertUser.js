const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// POST /api/upsertUser   body: { oid, email, name }
// Mirrors an Entra user into raul_tax_users, keyed by the Entra object id (oid).
// New users default to role 'user'; existing rows keep whatever role the DB
// holds (so a manual promotion to 'admin' is never overwritten on next sign-in).
// Called server-to-server by the Next.js auth routes after Entra issues tokens.
// Returns the saved row (including role).
app.http("upsertUser", {
  methods: ["POST"],
  authLevel: "function",
  route: "upsertUser",
  handler: async (request, context) => {
    try {
      const body = await request.json().catch(() => ({}));
      const { oid, email, name } = body || {};

      if (!oid) {
        return { status: 400, jsonBody: { error: "oid is required" } };
      }

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("email", sql.NVarChar(256), email ?? null)
        .input("name", sql.NVarChar(256), name ?? null).query(`
          MERGE raul_tax_users AS target
          USING (SELECT @oid AS entra_object_id) AS source
            ON target.entra_object_id = source.entra_object_id
          WHEN MATCHED THEN
            UPDATE SET email = @email, name = @name, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (entra_object_id, email, name, role, created_at, updated_at)
            VALUES (@oid, @email, @name, 'user', SYSUTCDATETIME(), SYSUTCDATETIME())
          OUTPUT inserted.id, inserted.entra_object_id, inserted.email,
                 inserted.name, inserted.role, inserted.created_at,
                 inserted.updated_at;
        `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("upsertUser failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
