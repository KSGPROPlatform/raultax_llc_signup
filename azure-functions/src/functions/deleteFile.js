const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { deleteBlob } = require("../blob");

// DELETE /api/deleteFile?id=&oid=   -> removes the blob + the metadata row.
// Ownership-checked.
app.http("deleteFile", {
  methods: ["DELETE"],
  authLevel: "function",
  route: "deleteFile",
  handler: async (request, context) => {
    try {
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
          SELECT blob_name FROM raul_tax_files WHERE id = @id AND owner_oid = @oid;
        `);

      const row = found.recordset[0];
      if (!row) return { status: 404, jsonBody: { error: "Not found" } };

      // Blob first, then the row (a leftover row with no blob is the safer failure).
      await deleteBlob(row.blob_name);
      await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("id", sql.Int, id).query(`
          DELETE FROM raul_tax_files WHERE id = @id AND owner_oid = @oid;
        `);

      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      context.error("deleteFile failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
