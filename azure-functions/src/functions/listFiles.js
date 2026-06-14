const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// GET /api/listFiles?oid=   -> the user's files (newest first)
app.http("listFiles", {
  methods: ["GET"],
  authLevel: "function",
  route: "listFiles",
  handler: async (request, context) => {
    try {
      const oid = request.query.get("oid");
      if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid).query(`
          SELECT id, owner_oid, blob_name, original_name, content_type,
                 size_bytes, stored_bytes, is_compressed, uploaded_at
          FROM raul_tax_files
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
