const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/jobs — a raultax user's jobs (one user has many). Each job's W-2 / 1099
// are stored separately as files (doc_type + job_id). Scoped by owner_oid.
//   GET    ?oid=                     -> list (newest first)
//   POST   { oid, id?, job_name }    -> insert, or owner-checked update when id given
//   DELETE ?oid=&id=                 -> owner-checked delete
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
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid).query(`
            SELECT id, owner_oid, job_name, created_at, updated_at
            FROM raul_tax_jobs
            WHERE owner_oid = @oid
            ORDER BY id DESC;
          `);
        return { status: 200, jsonBody: result.recordset };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const req = pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("job_name", sql.NVarChar(256), b.job_name ?? "");

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.job_name,
                 inserted.created_at, inserted.updated_at`;

        if (b.id) {
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_jobs
            SET job_name = @job_name, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_jobs (owner_oid, job_name)
          ${OUTPUT}
          VALUES (@oid, @job_name);
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
