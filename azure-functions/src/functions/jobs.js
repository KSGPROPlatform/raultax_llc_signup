const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/jobs — a raultax user's jobs (one user has many, PER TAX YEAR). Each
// job's W-2 / 1099 are stored separately as files (doc_type + job_id). Scoped
// by owner_oid.
//   GET    ?oid=&taxYear=                       -> list (year-filtered when given)
//   POST   { oid, id?, job_name, tax_year }     -> insert, or owner-checked update when id given
//   DELETE ?oid=&id=                            -> owner-checked delete
const FALLBACK_YEAR = () => new Date().getFullYear() - 1; // latest declarable year

app.http("jobs", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "jobs",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const taxYear = request.query.get("taxYear") ? Number(request.query.get("taxYear")) : NaN;
        const req = pool.request().input("oid", sql.NVarChar(64), oid);
        let where = "owner_oid = @oid";
        if (Number.isInteger(taxYear)) {
          req.input("year", sql.Int, taxYear);
          where += " AND tax_year = @year";
        }
        const result = await req.query(`
            SELECT id, owner_oid, job_name, occupation, company_name, tax_year,
                   created_at, updated_at
            FROM raul_tax_jobs
            WHERE ${where}
            ORDER BY id DESC;
          `);
        return { status: 200, jsonBody: result.recordset };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const year = Number.isInteger(Number(b.tax_year)) ? Number(b.tax_year) : FALLBACK_YEAR();
        const req = pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("job_name", sql.NVarChar(256), b.job_name ?? "")
          .input("occupation", sql.NVarChar(256), b.occupation ?? "")
          .input("company_name", sql.NVarChar(256), b.company_name ?? "")
          .input("year", sql.Int, year);

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.job_name,
                 inserted.occupation, inserted.company_name,
                 inserted.tax_year, inserted.created_at, inserted.updated_at`;

        if (b.id) {
          // Updates keep the row's original year.
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_jobs
            SET job_name = @job_name, occupation = @occupation,
                company_name = @company_name, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_jobs (owner_oid, job_name, occupation, company_name, tax_year)
          ${OUTPUT}
          VALUES (@oid, @job_name, @occupation, @company_name, @year);
        `);
        return { status: 201, jsonBody: result.recordset[0] };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        const id = Number(request.query.get("id"));
        if (!oid || !Number.isInteger(id)) {
          return { status: 400, jsonBody: { error: "oid and id are required" } };
        }
        // Detach the job's files first (keep the blobs/rows but clear the link),
        // then delete the job. (Owner-checked.)
        await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("id", sql.Int, id).query(`
            UPDATE raul_tax_files SET job_id = NULL WHERE job_id = @id AND owner_oid = @oid;
            DELETE FROM raul_tax_jobs WHERE id = @id AND owner_oid = @oid;
          `);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("jobs failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
