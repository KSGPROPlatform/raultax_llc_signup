const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { downloadBuffer, gunzip, deleteBlob } = require("../blob");
const { getAppConfig } = require("../config");
const { analyzeForDocType } = require("../docintel");

// The stored file is already compressed small at upload (under the DI input-size
// limit), so this function just reads it, extracts, and gates — no re-compression.

// Docs whose printed tax year must match the declaration year they were uploaded
// under, and docs cross-checked against the account holder's typed identity.
const YEAR_DOCS = new Set(["w2", "form_1099"]);
const IDENTITY_DOCS = new Set(["ssn_copy", "spouse_ssn_copy"]);

const digits = (v) => String(v ?? "").replace(/\D/g, "");

// Company/employer comparison: every significant token the user typed must
// appear in the form's company name (case-insensitive; legal suffixes like
// Inc/LLC and punctuation are ignored, so "Blue Beacon" matches
// "BLUE BEACON USA, LP").
const COMPANY_STOP = new Set([
  "inc", "llc", "corp", "co", "ltd", "company", "corporation", "lp", "llp", "plc", "the",
]);
function companyMatches(expectedCompany, formCompany) {
  const toks = (s) =>
    String(s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !COMPANY_STOP.has(t));
  const exp = toks(expectedCompany);
  const form = new Set(toks(formCompany));
  if (!exp.length || !form.size) return false;
  return exp.every((t) => form.has(t));
}

// The typed first AND last name must both appear as tokens in the card's name
// (case-insensitive, any order — tolerates middle names/initials on the card).
function nameMatches(expectedName, cardName) {
  const cardTokens = new Set(
    String(cardName).toLowerCase().split(/[^a-z]+/).filter(Boolean),
  );
  const expected = String(expectedName).toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (!expected.length || !cardTokens.size) return false;
  return expected.every((t) => cardTokens.has(t));
}

// Gate a successful extraction. Returns null to accept, or a rejection
// { reason, ...details } when the document must be refused.
function gateResult(docType, flat, expected) {
  if (YEAR_DOCS.has(docType)) {
    const docYear = Number(digits(flat.tax_year).slice(0, 4)) || null;
    if (!docYear) return { reason: "year_unreadable" };
    if (docYear !== expected.taxYear) {
      return { reason: "year_mismatch", doc_year: docYear, expected_year: expected.taxYear };
    }
    // The W-2 employee SSN / 1099 recipient TIN must belong to the account
    // holder. Forms often mask all but the LAST 4 DIGITS, so: full compare when
    // the form shows all 9, last-4 compare otherwise; unreadable -> reject.
    if (expected.ssn) {
      const formSsn = digits(flat.ssn);
      const userSsn = digits(expected.ssn);
      if (formSsn.length >= 9 && userSsn.length >= 9) {
        if (formSsn.slice(-9) !== userSsn.slice(-9)) return { reason: "ssn_mismatch" };
      } else if (formSsn.length >= 4) {
        if (formSsn.slice(-4) !== userSsn.slice(-4)) return { reason: "ssn_mismatch" };
      } else {
        return { reason: "ssn_unreadable" };
      }
    }
    // The employee (W-2) / recipient (1099) printed on the form must be the
    // account holder.
    if (expected.name) {
      const formName = String(flat.employee_name ?? flat.recipient_name ?? "").trim();
      if (!formName) return { reason: "name_unreadable" };
      if (!nameMatches(expected.name, formName)) return { reason: "name_mismatch" };
    }
    // And the employer (W-2) / payer company (1099) must be the company the
    // user entered on this job (skipped when the job has no company yet).
    if (expected.company) {
      const formCompany = String(flat.employer_name ?? flat.company_name ?? "").trim();
      if (!formCompany) return { reason: "company_unreadable" };
      if (!companyMatches(expected.company, formCompany)) return { reason: "company_mismatch" };
    }
  }
  if (IDENTITY_DOCS.has(docType)) {
    if (expected.ssn && digits(flat.ssn) !== digits(expected.ssn)) {
      return { reason: "ssn_mismatch" };
    }
    if (expected.name) {
      if (!String(flat.name ?? "").trim()) return { reason: "name_unreadable" };
      if (!nameMatches(expected.name, flat.name)) return { reason: "name_mismatch" };
    }
  }
  return null;
}

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
          SELECT id, blob_name, content_type, doc_type, is_compressed, tax_year, job_id
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

      // Rejection path shared by every gate: per the product rule we DON'T keep a
      // refused document or its data — the upload is deleted entirely.
      const rejectFile = async (details) => {
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
          jsonBody: {
            file_id: fileId,
            status: "mismatch",
            model: result.model ?? null,
            deleted: true,
            ...details,
          },
        };
      };

      // Gate 1: the file isn't the document this slot expects at all.
      if (result.status === "mismatch") {
        return rejectFile({ reason: "wrong_document" });
      }

      // A doc type we don't extract (e.g. W-4) — keep the file, store nothing.
      if (result.status === "unsupported") {
        return { status: 200, jsonBody: { file_id: fileId, doc_type: file.doc_type, status: "unsupported" } };
      }

      // Gates 2+3: the document read fine — now it must BELONG here. W-2/1099
      // must carry the declaration's tax year and the holder's SSN/name; the
      // employer/payer must match the job's company; SSN cards must match the
      // typed identity (expected values passed server-to-server by the app).
      let jobCompany = "";
      if (file.job_id != null && YEAR_DOCS.has(file.doc_type)) {
        const jr = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("jid", sql.Int, file.job_id)
          .query(`SELECT company_name FROM raul_tax_jobs WHERE id = @jid AND owner_oid = @oid;`)
          .catch(() => ({ recordset: [] }));
        jobCompany = (jr.recordset[0] && jr.recordset[0].company_name) || "";
      }
      const rejection = gateResult(file.doc_type, result.flat || {}, {
        taxYear,
        ssn: request.query.get("expectedSsn") || "",
        name: request.query.get("expectedName") || "",
        company: jobCompany.trim(),
      });
      if (rejection) return rejectFile(rejection);

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
