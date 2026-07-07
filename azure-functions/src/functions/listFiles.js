const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { getAppConfig } = require("../config");

// GET /api/listFiles?oid=   header: X-App-Id   -> the user's files (newest first)
app.http("listFiles", {
  methods: ["GET"],
  authLevel: "function",
  route: "listFiles",
  handler: async (request, context) => {
    try {
      const appId = request.headers.get("x-app-id") || "raultax";
      let cfg;
      try {
        cfg = getAppConfig(appId);
      } catch (e) {
        if (e.statusCode === 400) return { status: 400, jsonBody: { error: e.message } };
        context.error("config error", e);
        return { status: 500, jsonBody: { error: "Server misconfigured" } };
      }

      const oid = request.query.get("oid");
      if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };

      const pool = await getPool();
      // SELECT * so per-app extra columns (e.g. raultax's tax_year) come back
      // without breaking apps whose files table doesn't have them.
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid).query(`
          SELECT *
          FROM ${cfg.filesTable}
          WHERE owner_oid = @oid
          ORDER BY uploaded_at DESC;
        `);

      return { status: 200, jsonBody: result.recordset };
    } catch (err) {
      context.error("listFiles failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
