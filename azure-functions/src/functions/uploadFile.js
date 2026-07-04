const { app } = require("@azure/functions");
const { randomUUID } = require("node:crypto");
const { sql, getPool } = require("../db");
const { uploadBuffer, gzip } = require("../blob");
const { getAppConfig } = require("../config");
const { compressImage, isCompressibleImage } = require("../imageCompress");

// POST /api/uploadFile?oid=&filename=&contentType=&deferCompress=  header: X-App-Id
// body: raw file bytes. Stores the file in the app's Blob container and records a
// row in the app's files table. Called server-to-server by the calling app.
//   - Images > IMAGE_THRESHOLD are RE-ENCODED small (JPEG) so storage stays in KB.
//   - Non-images > THRESHOLD are gzip-compressed (restored on view/download).
//   - deferCompress=1 stores the image untouched (caller will compress later, e.g.
//     raultax keeps the original so Document Intelligence extracts on full quality,
//     then shrinks it afterwards).
const THRESHOLD = Number(process.env.COMPRESS_THRESHOLD_BYTES || 5 * 1024 * 1024);
const IMAGE_THRESHOLD = Number(process.env.IMAGE_COMPRESS_THRESHOLD_BYTES || 1024 * 1024); // 1 MB
const STORE_MAX_DIM = Number(process.env.IMAGE_STORE_MAX_DIM || 1500);
const STORE_QUALITY = Number(process.env.IMAGE_STORE_QUALITY || 68);

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
      const docType = request.query.get("docType") || null; // category; null = uncategorised
      const jobIdRaw = request.query.get("jobId");
      const jobId = jobIdRaw && /^\d+$/.test(jobIdRaw) ? Number(jobIdRaw) : null; // links W-2/1099 to a job
      const taxYearRaw = request.query.get("taxYear");
      const taxYear = taxYearRaw && /^\d{4}$/.test(taxYearRaw) ? Number(taxYearRaw) : null; // tax year (raultax only)
      const deferCompress =
        request.query.get("deferCompress") === "1" || request.query.get("deferCompress") === "true";
      if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };

      const raw = Buffer.from(await request.arrayBuffer());
      if (!raw.length) return { status: 400, jsonBody: { error: "Empty file" } };

      const sizeBytes = raw.length;
      const isImage = /^image\//i.test(contentType);

      let data = raw;
      let dbContentType = contentType; // what view/download should serve as
      let gz = false; // is_compressed (gzip)
      let imageCompressed = false;

      // Images: re-encode small (unless the caller defers compression).
      if (isImage && !deferCompress && sizeBytes > IMAGE_THRESHOLD && isCompressibleImage(contentType)) {
        try {
          const c = await compressImage(raw, { maxDim: STORE_MAX_DIM, quality: STORE_QUALITY });
          if (c.contentType === "image/jpeg") {
            data = c.buffer;
            dbContentType = "image/jpeg";
            imageCompressed = true;
          }
        } catch (e) {
          context.error("image compress failed; storing original", e && e.message);
        }
      }

      // Non-images over the threshold: gzip (images are never gzipped — it doesn't
      // help; we re-encode them instead).
      if (!imageCompressed && !isImage && sizeBytes > THRESHOLD) {
        data = gzip(raw);
        gz = true;
      }

      const storedBytes = data.length;
      const safe = filename.replace(/[^\w.\-]+/g, "_").slice(-200);
      const blobName = `${oid}/${randomUUID()}__${safe}${gz ? ".gz" : ""}`;
      const blobContentType = gz
        ? "application/gzip"
        : imageCompressed
          ? "image/jpeg"
          : contentType;

      await uploadBuffer(cfg.container, blobName, data, blobContentType);

      const pool = await getPool();
      const req = pool
        .request()
        .input("oid", sql.NVarChar(64), oid)
        .input("blob", sql.NVarChar(512), blobName)
        .input("name", sql.NVarChar(256), filename)
        .input("ctype", sql.NVarChar(128), dbContentType)
        .input("size", sql.BigInt, sizeBytes)
        .input("stored", sql.BigInt, storedBytes)
        .input("comp", sql.Bit, gz ? 1 : 0)
        .input("docType", sql.NVarChar(64), docType)
        .input("jobId", sql.Int, jobId);

      // tax_year is optional (only raultax passes it). Add it to the INSERT only
      // when present, so apps whose files table lacks the column are unaffected.
      const cols = [
        "owner_oid", "blob_name", "original_name", "content_type", "size_bytes",
        "stored_bytes", "is_compressed", "doc_type", "job_id",
      ];
      const vals = ["@oid", "@blob", "@name", "@ctype", "@size", "@stored", "@comp", "@docType", "@jobId"];
      if (taxYear != null) {
        req.input("taxYear", sql.Int, taxYear);
        cols.push("tax_year");
        vals.push("@taxYear");
      }

      const result = await req.query(`
        INSERT INTO ${cfg.filesTable} (${cols.join(", ")})
        OUTPUT inserted.id, inserted.owner_oid, inserted.blob_name,
               inserted.original_name, inserted.content_type, inserted.size_bytes,
               inserted.stored_bytes, inserted.is_compressed, inserted.doc_type, inserted.job_id, inserted.uploaded_at
        VALUES (${vals.join(", ")});
      `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("uploadFile failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
