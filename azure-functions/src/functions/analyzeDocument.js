const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { downloadBuffer, gunzip, deleteBlob } = require("../blob");
const { getAppConfig } = require("../config");
const { analyzeForDocType } = require("../docintel");

// /api/analyzeDocument — run Azure Document Intelligence over an uploaded file
// and store the structured result in raul_tax_file_extractions (one per file).
//   GET  ?oid=&fileId=   -> the stored extraction, or null
//   POST ?oid=&fileId=   -> download the blob, send to the matching prebuilt
//                           model, upsert + return the extraction
// Owner-scoped: the file row is loaded WHERE owner_oid = @oid, so a caller can
// only ever analyze their own uploads.

async function upsertExtraction(pool, e) {
  const result = await pool
    .request()
    .input("fid", sql.Int, e.fileId)
    .input("oid", sql.NVarChar(64), e.oid)
    .input("doc", sql.NVarChar(64), e.docType ?? null)
    .input("model", sql.NVarChar(64), e.model ?? null)
    .input("status", sql.NVarChar(32), e.status)
    .input("fields", sql.NVarChar(sql.MAX), e.fieldsJson ?? null)
    .input("rich", sql.NVarChar(sql.MAX), e.richJson ?? null)
    .input("year", sql.Int, e.taxYear ?? null)
    .input("error", sql.NVarChar(512), e.error ?? null).query(`
      MERGE raul_tax_file_extractions AS t
      USING (SELECT @fid AS file_id) AS s ON t.file_id = s.file_id
      WHEN MATCHED THEN UPDATE SET
        owner_oid = @oid, doc_type = @doc, model = @model, status = @status,
        fields_json = @fields, rich_json = @rich, tax_year = @year, error = @error,
        updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (file_id, owner_oid, doc_type, model, status, fields_json, rich_json, tax_year, error)
        VALUES (@fid, @oid, @doc, @model, @status, @fields, @rich, @year, @error)
      OUTPUT inserted.file_id, inserted.doc_type, inserted.model, inserted.status,
             inserted.fields_json, inserted.tax_year, inserted.error, inserted.updated_at;
    `);
  return result.recordset[0];
}

app.http("analyzeDocument", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "analyzeDocument",
  handler: async (request, context) => {
    const oid = request.query.get("oid");
    const fileId = Number(request.query.get("fileId"));
    if (!oid || !Number.isInteger(fileId)) {
      return { status: 400, jsonBody: { error: "oid and fileId are required" } };
    }

    let pool;
    try {
      pool = await getPool();
    } catch (err) {
      context.error("analyzeDocument pool failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }

    // Remove the stored extraction (called when the underlying file is deleted so
    // extracted sensitive data doesn't outlive the document).
    if (request.method === "DELETE") {
      await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("fid", sql.Int, fileId)
        .query(`DELETE FROM raul_tax_file_extractions WHERE file_id = @fid AND owner_oid = @oid;`);
      return { status: 200, jsonBody: { ok: true } };
    }

    if (request.method === "GET") {
      const r = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("fid", sql.Int, fileId).query(`
          SELECT file_id, doc_type, model, status, fields_json, tax_year, error, updated_at
          FROM raul_tax_file_extractions
          WHERE file_id = @fid AND owner_oid = @oid;
        `);
      return { status: 200, jsonBody: r.recordset[0] ?? null };
    }

    // POST — run the extraction.
    let docType = null;
    try {
      const appId = request.headers.get("x-app-id") || "raultax";
      const cfg = getAppConfig(appId);

      const fr = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("fid", sql.Int, fileId).query(`
          SELECT id, blob_name, content_type, doc_type, is_compressed, tax_year
          FROM ${cfg.filesTable}
          WHERE id = @fid AND owner_oid = @oid;
        `);
      const file = fr.recordset[0];
      if (!file) return { status: 404, jsonBody: { error: "File not found" } };
      docType = file.doc_type;
      const taxYear = file.tax_year != null ? file.tax_year : new Date().getFullYear();

      let bytes = await downloadBuffer(cfg.container, file.blob_name);
      if (file.is_compressed) bytes = gunzip(bytes);

      const result = await analyzeForDocType(file.doc_type, bytes);

      // Stage-1 rejection: the file isn't the document this slot expects. Per the
      // product rule we DON'T store its data — we delete the upload entirely.
      if (result.status === "mismatch") {
        await deleteBlob(cfg.container, file.blob_name).catch(() => {});
        await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("fid", sql.Int, fileId)
          .query(`DELETE FROM ${cfg.filesTable} WHERE id = @fid AND owner_oid = @oid;`);
        await pool
          .request()
          .input("fid", sql.Int, fileId)
          .query(`DELETE FROM raul_tax_file_extractions WHERE file_id = @fid;`)
          .catch(() => {});
        return {
          status: 200,
          jsonBody: { file_id: fileId, status: "mismatch", model: result.model ?? null, deleted: true },
        };
      }

      // A doc type we don't extract (e.g. W-4) — keep the file, store nothing.
      if (result.status === "unsupported") {
        return { status: 200, jsonBody: { file_id: fileId, doc_type: file.doc_type, status: "unsupported" } };
      }

      await upsertExtraction(pool, {
        fileId,
        oid,
        docType: file.doc_type,
        model: result.model ?? null,
        status: result.status,
        fieldsJson: result.flat ? JSON.stringify(result.flat) : null,
        richJson: result.rich ? JSON.stringify(result.rich) : null,
        taxYear,
        error: null,
      });

      return {
        status: 200,
        jsonBody: {
          file_id: fileId,
          doc_type: file.doc_type,
          model: result.model ?? null,
          status: result.status,
          tax_year: taxYear,
          fields: result.flat ?? null,
        },
      };
    } catch (err) {
      context.error("analyzeDocument failed", err);
      // Record the failure so the UI can stop waiting (best-effort).
      try {
        await upsertExtraction(pool, {
          fileId,
          oid,
          docType,
          model: null,
          status: "error",
          fieldsJson: null,
          richJson: null,
          error: String(err && err.message ? err.message : err).slice(0, 500),
        });
      } catch {
        /* ignore */
      }
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
