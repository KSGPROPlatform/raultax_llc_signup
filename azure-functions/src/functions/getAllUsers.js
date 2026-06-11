const { app } = require("@azure/functions");
const { getPool } = require("../db");

// GET /api/getAllUsers
// Admin panel: lists every user. Our app only calls this when the signed-in
// user's role is 'admin' (and you can add a server-side role check too).
app.http("getAllUsers", {
  methods: ["GET"],
  authLevel: "function",
  route: "getAllUsers",
  handler: async (request, context) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT id, entra_object_id, email, name, tenant_id, role,
               created_at, updated_at
        FROM raul_tax_users
        ORDER BY created_at DESC;
      `);

      return { status: 200, jsonBody: result.recordset };
    } catch (err) {
      context.error("getAllUsers failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
