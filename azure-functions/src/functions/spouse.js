const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/spouse — a raultax user's spouse (ONE per user PER TAX YEAR). Driven by
// the Form-1 filing status: full record for "Married filing jointly", SSN only
// for "Married filing separately". Sensitive fields (ssn) live here, not in
// Entra. Every query is scoped by owner_oid so a caller only touches their own.
//   GET    ?oid=&taxYear=                         -> that year's spouse row, or null
//   POST   { oid, tax_year, ...fields }           -> upsert for the year (absent fields are kept)
//   DELETE ?oid=&taxYear=                         -> remove that year's spouse (all years if no year)
const COLS = `id, owner_oid, first_name, last_name, date_of_birth, ssn,
              street_address, city, state_province, postal_code, tax_year,
              created_at, updated_at`;
const FALLBACK_YEAR = () => new Date().getFullYear() - 1; // latest declarable year

app.http("spouse", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "spouse",
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
        const result = await req.query(
          `SELECT TOP 1 ${COLS} FROM raul_tax_spouse WHERE ${where} ORDER BY tax_year DESC;`,
        );
        return { status: 200, jsonBody: result.recordset[0] ?? null };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };
        // Pass null for absent fields so COALESCE keeps the stored value — this
        // lets the MFS "SSN only" save not wipe a previously-entered full record.
        const orNull = (v) => (typeof v === "string" ? v : null);
        const year = Number.isInteger(Number(b.tax_year)) ? Number(b.tax_year) : FALLBACK_YEAR();
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("year", sql.Int, year)
          .input("first_name", sql.NVarChar(256), orNull(b.first_name))
          .input("last_name", sql.NVarChar(256), orNull(b.last_name))
          .input("date_of_birth", sql.NVarChar(32), orNull(b.date_of_birth))
          .input("ssn", sql.NVarChar(32), orNull(b.ssn))
          .input("street_address", sql.NVarChar(256), orNull(b.street_address))
          .input("city", sql.NVarChar(128), orNull(b.city))
          .input("state_province", sql.NVarChar(128), orNull(b.state_province))
          .input("postal_code", sql.NVarChar(16), orNull(b.postal_code)).query(`
            MERGE raul_tax_spouse AS t
            USING (SELECT @oid AS owner_oid, @year AS tax_year) AS s
              ON t.owner_oid = s.owner_oid AND t.tax_year = s.tax_year
            WHEN MATCHED THEN UPDATE SET
              first_name = COALESCE(@first_name, t.first_name),
              last_name = COALESCE(@last_name, t.last_name),
              date_of_birth = COALESCE(@date_of_birth, t.date_of_birth),
              ssn = COALESCE(@ssn, t.ssn),
              street_address = COALESCE(@street_address, t.street_address),
              city = COALESCE(@city, t.city),
              state_province = COALESCE(@state_province, t.state_province),
              postal_code = COALESCE(@postal_code, t.postal_code),
              updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT
              (owner_oid, tax_year, first_name, last_name, date_of_birth, ssn,
               street_address, city, state_province, postal_code)
              VALUES (@oid, @year, COALESCE(@first_name, ''), COALESCE(@last_name, ''),
                      COALESCE(@date_of_birth, ''), COALESCE(@ssn, ''),
                      COALESCE(@street_address, ''), COALESCE(@city, ''),
                      COALESCE(@state_province, ''), COALESCE(@postal_code, ''))
            OUTPUT inserted.id, inserted.owner_oid, inserted.first_name,
                   inserted.last_name, inserted.date_of_birth, inserted.ssn,
                   inserted.street_address, inserted.city, inserted.state_province,
                   inserted.postal_code, inserted.tax_year,
                   inserted.created_at, inserted.updated_at;
          `);
        return { status: 200, jsonBody: result.recordset[0] };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const taxYear = request.query.get("taxYear") ? Number(request.query.get("taxYear")) : NaN;
        const req = pool.request().input("oid", sql.NVarChar(64), oid);
        let where = "owner_oid = @oid";
        if (Number.isInteger(taxYear)) {
          req.input("year", sql.Int, taxYear);
          where += " AND tax_year = @year";
        }
        await req.query(`DELETE FROM raul_tax_spouse WHERE ${where};`);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("spouse failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
