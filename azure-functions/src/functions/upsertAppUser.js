const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { getAppConfig } = require("../config");

// POST /api/upsertAppUser   header: X-App-Id   body: { oid, email?, name?, profile?:object }
// GENERIC Entra->SQL user mirror for any app. App-specific fields go in the
// `profile` JSON (NVARCHAR(MAX)) column — no bespoke columns. New users default
// role 'user'; on an existing row email/name overwrite and `profile` is COALESCE'd
// so a profile-less sign-in never wipes it. Returns the saved row (incl. role).
//
// (raultax keeps its own typed-column `upsertUser` instead of this.)
app.http("upsertAppUser", {
  methods: ["POST"],
  authLevel: "function",
  route: "upsertAppUser",
  handler: async (request, context) => {
    try {
      const appId = request.headers.get("x-app-id");
      let cfg;
      try {
        cfg = getAppConfig(appId);
      } catch (e) {
        if (e.statusCode === 400) return { status: 400, jsonBody: { error: e.message } };
        context.error("config error", e);
        return { status: 500, jsonBody: { error: "Server misconfigured" } };
      }
      if (!cfg.usersTable) {
        return { status: 400, jsonBody: { error: `App ${appId} has no usersTable` } };
      }

      const b = (await request.json().catch(() => ({}))) || {};
      if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };

      // Only send profile when present, so COALESCE preserves prior JSON.
      const profileJson =
        b.profile && typeof b.profile === "object" ? JSON.stringify(b.profile) : null;

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), b.oid)
        .input("email", sql.NVarChar(256), b.email ?? null)
        .input("name", sql.NVarChar(256), b.name ?? null)
        .input("profile", sql.NVarChar(sql.MAX), profileJson).query(`
          MERGE ${cfg.usersTable} AS target
          USING (SELECT @oid AS entra_object_id) AS source
            ON target.entra_object_id = source.entra_object_id
          WHEN MATCHED THEN
            UPDATE SET email = @email, name = @name,
                       profile = COALESCE(@profile, profile),
                       updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (entra_object_id, email, name, role, profile, created_at, updated_at)
            VALUES (@oid, @email, @name, 'user', @profile, SYSUTCDATETIME(), SYSUTCDATETIME())
          OUTPUT inserted.id, inserted.entra_object_id, inserted.email,
                 inserted.name, inserted.role, inserted.profile;
        `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("upsertAppUser failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
