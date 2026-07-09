const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { deleteBlob } = require("../blob");
const { getAppConfig } = require("../config");

// DELETE /api/deleteFile?id=&oid=   header: X-App-Id   -> removes blob + row.
// Ownership-checked.
app.http("deleteFile", {
  methods: ["DELETE"],
  authLevel: "function",
  route: "deleteFile",
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
      const found = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("id", sql.Int, id).query(`
          SELECT blob_name FROM ${cfg.filesTable} WHERE id = @id AND owner_oid = @oid;
        `);

      const row = found.recordset[0];
      if (!row) return { status: 404, jsonBody: { error: "Not found" } };

      // Blob first, then the row (a leftover row with no blob is the safer failure).
      await deleteBlob(cfg.container, row.blob_name);
      await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("id", sql.Int, id).query(`
          DELETE FROM ${cfg.filesTable} WHERE id = @id AND owner_oid = @oid;
        `);

      // raultax: the extracted data must not outlive the document (and orphaned
      // extraction rows would otherwise pollute the 1040 sums).
      if (appId === "raultax") {
        await pool
          .request()
          .input("id", sql.Int, id)
          .query(`DELETE FROM raul_tax_file_extractions WHERE file_id = @id;`)
          .catch(() => {});
      }

      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      context.error("deleteFile failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
