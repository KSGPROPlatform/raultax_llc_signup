const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/declarations — a raultax user's tax declarations (one per tax year).
// The year is the filing's primary attribute; every per-year table hangs off it.
//   GET  ?oid=              -> list (newest year first) + per-year section counts
//   POST { oid, taxYear }   -> idempotent create (MERGE on owner+year). On a
//                              FRESH year, copy-forward: dependents, bank
//                              accounts, jobs, companies (P&L reset) and spouse
//                              are cloned from the most recent other year so
//                              the user only edits what changed.
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
            SELECT d.id, d.owner_oid, d.tax_year, d.status, d.created_at, d.updated_at,
              (SELECT COUNT(*) FROM raul_tax_jobs j
                 WHERE j.owner_oid = d.owner_oid AND j.tax_year = d.tax_year)  AS jobs,
              (SELECT COUNT(*) FROM raul_tax_bank_accounts b
                 WHERE b.owner_oid = d.owner_oid AND b.tax_year = d.tax_year)  AS bank_accounts,
              (SELECT COUNT(*) FROM raul_tax_companies c
                 WHERE c.owner_oid = d.owner_oid AND c.tax_year = d.tax_year)  AS companies,
              (SELECT COUNT(*) FROM raul_tax_dependents dep
                 WHERE dep.owner_oid = d.owner_oid AND dep.tax_year = d.tax_year) AS dependents
            FROM raul_tax_declarations d
            WHERE d.owner_oid = @oid
            ORDER BY d.tax_year DESC;
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
            OUTPUT $action AS merge_action, inserted.id, inserted.owner_oid,
                   inserted.tax_year, inserted.status,
                   inserted.created_at, inserted.updated_at;
          `);
        const row = result.recordset[0];
        const fresh = row && row.merge_action === "INSERT";
        delete row.merge_action;

        // Copy-forward for a brand-new year: clone the per-year data from the
        // most recent OTHER declared year. Companies start with an empty P&L
        // (business_expense reset; line items are annual and are NOT copied).
        if (fresh) {
          try {
            await pool
              .request()
              .input("oid", sql.NVarChar(64), b.oid)
              .input("year", sql.Int, taxYear).query(`
                DECLARE @src INT = (
                  SELECT TOP 1 tax_year FROM raul_tax_declarations
                  WHERE owner_oid = @oid AND tax_year <> @year
                  ORDER BY tax_year DESC
                );
                IF @src IS NOT NULL
                BEGIN
                  INSERT INTO raul_tax_dependents (owner_oid, full_name, ssn, date_of_birth, relationship, tax_year)
                    SELECT owner_oid, full_name, ssn, date_of_birth, relationship, @year
                    FROM raul_tax_dependents WHERE owner_oid = @oid AND tax_year = @src;

                  INSERT INTO raul_tax_bank_accounts (owner_oid, bank_name, account_number, routing_number, tax_year)
                    SELECT owner_oid, bank_name, account_number, routing_number, @year
                    FROM raul_tax_bank_accounts WHERE owner_oid = @oid AND tax_year = @src;

                  INSERT INTO raul_tax_jobs (owner_oid, job_name, tax_year)
                    SELECT owner_oid, job_name, @year
                    FROM raul_tax_jobs WHERE owner_oid = @oid AND tax_year = @src;

                  INSERT INTO raul_tax_companies (owner_oid, company_name, ein, activities, business_expense, tax_year)
                    SELECT owner_oid, company_name, ein, activities, NULL, @year
                    FROM raul_tax_companies WHERE owner_oid = @oid AND tax_year = @src;

                  INSERT INTO raul_tax_spouse (owner_oid, tax_year, first_name, last_name, date_of_birth, ssn,
                                               street_address, city, state_province, postal_code)
                    SELECT owner_oid, @year, first_name, last_name, date_of_birth, ssn,
                           street_address, city, state_province, postal_code
                    FROM raul_tax_spouse WHERE owner_oid = @oid AND tax_year = @src;
                END
              `);
          } catch (copyErr) {
            // Best-effort: a failed copy must never block starting the year.
            context.error("declaration copy-forward failed", copyErr);
          }
        }

        return { status: 200, jsonBody: row };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("declarations failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
