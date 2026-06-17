const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { downloadBuffer, gunzip } = require("../blob");
const { getAppConfig } = require("../config");

// GET /api/viewFile?id=&oid=   header: X-App-Id   -> the raw (decompressed) bytes.
// Ownership-checked. Returns the ORIGINAL content type so the app can serve it
// inline (preview) or as an attachment (download).
app.http("viewFile", {
  methods: ["GET"],
  authLevel: "function",
  route: "viewFile",
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
      const id = Number(request.query.get("id"));
      if (!oid || !Number.isInteger(id)) {
        return { status: 400, jsonBody: { error: "id and oid are required" } };
      }

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("id", sql.Int, id).query(`
          SELECT blob_name, original_name, content_type, is_compressed
          FROM ${cfg.filesTable}
          WHERE id = @id AND owner_oid = @oid;
        `);

      const row = result.recordset[0];
      if (!row) return { status: 404, jsonBody: { error: "Not found" } };

      let buf = await downloadBuffer(cfg.container, row.blob_name);
      if (row.is_compressed) buf = gunzip(buf);

      return {
        status: 200,
        body: buf,
        headers: {
          "Content-Type": row.content_type || "application/octet-stream",
          "X-Original-Name": encodeURIComponent(row.original_name || "file"),
        },
      };
    } catch (err) {
      context.error("viewFile failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
