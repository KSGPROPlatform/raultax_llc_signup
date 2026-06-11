const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// GET /api/getUser?oid=<entra object id>
// Returns one user's stored profile (including role) for the normal dashboard.
app.http("getUser", {
  methods: ["GET"],
  authLevel: "function",
  route: "getUser",
  handler: async (request, context) => {
    try {
      const oid = request.query.get("oid");
      if (!oid) {
        return { status: 400, jsonBody: { error: "oid query param is required" } };
      }

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .query(`
          SELECT id, entra_object_id, email, name, tenant_id, role,
                 created_at, updated_at
          FROM raul_tax_users
          WHERE entra_object_id = @oid;
        `);

      if (result.recordset.length === 0) {
        return { status: 404, jsonBody: { error: "User not found" } };
      }
      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("getUser failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
