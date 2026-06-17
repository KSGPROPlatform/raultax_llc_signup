const { app } = require("@azure/functions");
const { randomUUID } = require("node:crypto");
const { sql, getPool } = require("../db");
const { uploadBuffer, gzip } = require("../blob");
const { getAppConfig } = require("../config");

// POST /api/uploadFile?oid=&filename=&contentType=   header: X-App-Id
// body: raw file bytes. Stores the file in the app's Blob container (gzip-
// compressed when larger than the threshold) and records a row in the app's
// files table. Called server-to-server by the calling app.
const THRESHOLD = Number(process.env.COMPRESS_THRESHOLD_BYTES || 5 * 1024 * 1024);

app.http("uploadFile", {
  methods: ["POST"],
  authLevel: "function",
  route: "uploadFile",
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
      const filename = request.query.get("filename") || "file";
      const contentType =
        request.query.get("contentType") || "application/octet-stream";
      if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };

      const raw = Buffer.from(await request.arrayBuffer());
      if (!raw.length) return { status: 400, jsonBody: { error: "Empty file" } };

      const sizeBytes = raw.length;
      const compress = sizeBytes > THRESHOLD;
      const data = compress ? gzip(raw) : raw;
      const storedBytes = data.length;

      const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-200);
      const blobName = `${oid}/${randomUUID()}__${safe}${compress ? ".gz" : ""}`;

      // Compressed blobs are stored as gzip; the ORIGINAL content type lives in
      // the DB so download/view can restore it after gunzip.
      await uploadBuffer(
        cfg.container,
        blobName,
        data,
        compress ? "application/gzip" : contentType,
      );

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("blob", sql.NVarChar(512), blobName)
        .input("name", sql.NVarChar(256), filename)
        .input("ctype", sql.NVarChar(128), contentType)
        .input("size", sql.BigInt, sizeBytes)
        .input("stored", sql.BigInt, storedBytes)
        .input("comp", sql.Bit, compress ? 1 : 0).query(`
          INSERT INTO ${cfg.filesTable}
            (owner_oid, blob_name, original_name, content_type, size_bytes, stored_bytes, is_compressed)
          OUTPUT inserted.id, inserted.owner_oid, inserted.blob_name,
                 inserted.original_name, inserted.content_type, inserted.size_bytes,
                 inserted.stored_bytes, inserted.is_compressed, inserted.uploaded_at
          VALUES (@oid, @blob, @name, @ctype, @size, @stored, @comp);
        `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("uploadFile failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
