const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/declarations — a raultax user's tax declarations (one per tax year).
// The year is the filing's primary attribute; documents (and, in later phases,
// the other per-year tables) hang off it. Scoped by owner_oid.
//   GET  ?oid=              -> list (newest year first)
//   POST { oid, taxYear }   -> idempotent create (MERGE on owner+year)
const COLS = "id, owner_oid, tax_year, status, created_at, updated_at";

app.http("declarations", {
  methods: ["GET", "POST"],
  authLevel: "function",
  route: "declarations",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid).query(`
            SELECT ${COLS} FROM raul_tax_declarations
            WHERE owner_oid = @oid
            ORDER BY tax_year DESC;
          `);
        return { status: 200, jsonBody: result.recordset };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        const taxYear = Number(b.taxYear);
        if (!b.oid || !Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
          return { status: 400, jsonBody: { error: "oid and a valid taxYear are required" } };
        }
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("year", sql.Int, taxYear).query(`
            MERGE raul_tax_declarations AS t
            USING (SELECT @oid AS owner_oid, @year AS tax_year) AS s
              ON t.owner_oid = s.owner_oid AND t.tax_year = s.tax_year
            WHEN MATCHED THEN UPDATE SET updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (owner_oid, tax_year) VALUES (@oid, @year)
            OUTPUT inserted.id, inserted.owner_oid, inserted.tax_year,
                   inserted.status, inserted.created_at, inserted.updated_at;
          `);
        return { status: 200, jsonBody: result.recordset[0] };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("declarations failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
