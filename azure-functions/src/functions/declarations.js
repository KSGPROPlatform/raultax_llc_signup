const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/declarations — a raultax user's tax declarations (one per tax year).
// The year is the filing's primary attribute; every per-year table hangs off
// it, and the 1040 facts that can change between years live HERE (filing
// status, marital status, home address). Identity stays on raul_tax_users.
//   GET  ?oid=                    -> list (newest year first) + per-year section counts
//   POST { oid, taxYear, ...per-year fields?, status? }
//        -> idempotent upsert (MERGE on owner+year); absent fields are kept.
//           On a FRESH year, copy-forward: dependents, bank accounts, jobs,
//           companies (P&L reset), spouse AND the per-year 1040 fields are
//           cloned from the most recent other year.
const FIELD_COLS = `filing_status, marital_status, street_address, city,
                    state_province, postal_code`;

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
            SELECT d.id, d.owner_oid, d.tax_year, d.status,
              d.filing_status, d.marital_status, d.street_address, d.city,
              d.state_province, d.postal_code, d.created_at, d.updated_at,
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
        // Absent fields -> null -> COALESCE keeps stored values, so a bare
        // {taxYear} POST (year picker / Step 0) never wipes anything.
        const orNull = (v) => (typeof v === "string" ? v : null);
        const status =
          b.status === "submitted" || b.status === "draft" ? b.status : null;
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("year", sql.Int, taxYear)
          .input("status", sql.NVarChar(16), status)
          .input("filing_status", sql.NVarChar(64), orNull(b.filing_status))
          .input("marital_status", sql.NVarChar(64), orNull(b.marital_status))
          .input("street_address", sql.NVarChar(256), orNull(b.street_address))
          .input("city", sql.NVarChar(128), orNull(b.city))
          .input("state_province", sql.NVarChar(128), orNull(b.state_province))
          .input("postal_code", sql.NVarChar(32), orNull(b.postal_code)).query(`
            MERGE raul_tax_declarations AS t
            USING (SELECT @oid AS owner_oid, @year AS tax_year) AS s
              ON t.owner_oid = s.owner_oid AND t.tax_year = s.tax_year
            WHEN MATCHED THEN UPDATE SET
              status         = COALESCE(@status, t.status),
              filing_status  = COALESCE(@filing_status, t.filing_status),
              marital_status = COALESCE(@marital_status, t.marital_status),
              street_address = COALESCE(@street_address, t.street_address),
              city           = COALESCE(@city, t.city),
              state_province = COALESCE(@state_province, t.state_province),
              postal_code    = COALESCE(@postal_code, t.postal_code),
              updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT
              (owner_oid, tax_year, status, ${FIELD_COLS})
              VALUES (@oid, @year, COALESCE(@status, 'draft'),
                      COALESCE(@filing_status, ''), COALESCE(@marital_status, ''),
                      COALESCE(@street_address, ''), COALESCE(@city, ''),
                      COALESCE(@state_province, ''), COALESCE(@postal_code, ''))
            OUTPUT $action AS merge_action, inserted.id, inserted.owner_oid,
                   inserted.tax_year, inserted.status, inserted.filing_status,
                   inserted.marital_status, inserted.street_address, inserted.city,
                   inserted.state_province, inserted.postal_code,
                   inserted.created_at, inserted.updated_at;
          `);
        const row = result.recordset[0];
        const fresh = row && row.merge_action === "INSERT";
        delete row.merge_action;

        // Copy-forward for a brand-new year: clone the per-year data from the
        // most recent OTHER declared year. Companies start with an empty P&L
        // (business_expense reset; line items are annual and are NOT copied).
        // The declaration's own 1040 fields copy only where still empty, so
        // values sent with THIS request win.
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
                  UPDATE dnew SET
                    filing_status  = CASE WHEN dnew.filing_status  = '' THEN dsrc.filing_status  ELSE dnew.filing_status  END,
                    marital_status = CASE WHEN dnew.marital_status = '' THEN dsrc.marital_status ELSE dnew.marital_status END,
                    street_address = CASE WHEN dnew.street_address = '' THEN dsrc.street_address ELSE dnew.street_address END,
                    city           = CASE WHEN dnew.city           = '' THEN dsrc.city           ELSE dnew.city           END,
                    state_province = CASE WHEN dnew.state_province = '' THEN dsrc.state_province ELSE dnew.state_province END,
                    postal_code    = CASE WHEN dnew.postal_code    = '' THEN dsrc.postal_code    ELSE dnew.postal_code    END
                  FROM raul_tax_declarations dnew
                  JOIN raul_tax_declarations dsrc
                    ON dsrc.owner_oid = dnew.owner_oid AND dsrc.tax_year = @src
                  WHERE dnew.owner_oid = @oid AND dnew.tax_year = @year;

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
