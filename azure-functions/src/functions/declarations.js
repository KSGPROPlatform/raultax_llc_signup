const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { deleteBlob } = require("../blob");
const { getAppConfig } = require("../config");

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
//   DELETE ?oid=&taxYear=         -> remove the year's declaration AND all its
//           per-year data (rows + year-scoped documents' blobs). Refused when
//           the year's return is FROZEN (preparer approved).
const FIELD_COLS = `filing_status, marital_status, street_address, city,
                    state_province, postal_code`;

app.http("declarations", {
  methods: ["GET", "POST", "DELETE"],
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
              d.state_province, d.postal_code, d.owns_establishment,
              d.created_at, d.updated_at,
              (SELECT COUNT(*) FROM raul_tax_spouse s
                 WHERE s.owner_oid = d.owner_oid AND s.tax_year = d.tax_year)  AS spouse,
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
        const ownsBit =
          typeof b.owns_establishment === "boolean" ? (b.owns_establishment ? 1 : 0) : null;
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("year", sql.Int, taxYear)
          .input("status", sql.NVarChar(16), status)
          .input("owns", sql.Bit, ownsBit)
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
              owns_establishment = COALESCE(@owns, t.owns_establishment),
              filing_status  = COALESCE(@filing_status, t.filing_status),
              marital_status = COALESCE(@marital_status, t.marital_status),
              street_address = COALESCE(@street_address, t.street_address),
              city           = COALESCE(@city, t.city),
              state_province = COALESCE(@state_province, t.state_province),
              postal_code    = COALESCE(@postal_code, t.postal_code),
              updated_at = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT
              (owner_oid, tax_year, status, owns_establishment, ${FIELD_COLS})
              VALUES (@oid, @year, COALESCE(@status, 'draft'), @owns,
                      COALESCE(@filing_status, ''), COALESCE(@marital_status, ''),
                      COALESCE(@street_address, ''), COALESCE(@city, ''),
                      COALESCE(@state_province, ''), COALESCE(@postal_code, ''))
            OUTPUT $action AS merge_action, inserted.id, inserted.owner_oid,
                   inserted.tax_year, inserted.status, inserted.owns_establishment,
                   inserted.filing_status,
                   inserted.marital_status, inserted.street_address, inserted.city,
                   inserted.state_province, inserted.postal_code,
                   inserted.created_at, inserted.updated_at;
          `);
        let row = result.recordset[0];
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
                    owns_establishment = COALESCE(dnew.owns_establishment, dsrc.owns_establishment),
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

                  INSERT INTO raul_tax_jobs (owner_oid, job_name, occupation, company_name, tax_year)
                    SELECT owner_oid, job_name, occupation, company_name, @year
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
            // Re-read so the response reflects the copied-forward fields.
            const reread = await pool
              .request()
              .input("oid", sql.NVarChar(64), b.oid)
              .input("year", sql.Int, taxYear).query(`
                SELECT id, owner_oid, tax_year, status, owns_establishment,
                       ${FIELD_COLS}, created_at, updated_at
                FROM raul_tax_declarations
                WHERE owner_oid = @oid AND tax_year = @year;
              `);
            if (reread.recordset[0]) row = reread.recordset[0];
          } catch (copyErr) {
            // Best-effort: a failed copy must never block starting the year.
            context.error("declaration copy-forward failed", copyErr);
          }
        }

        return { status: 200, jsonBody: row };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        const taxYear = Number(request.query.get("taxYear"));
        if (!oid || !Number.isInteger(taxYear)) {
          return { status: 400, jsonBody: { error: "oid and taxYear are required" } };
        }

        // An approved (frozen) return is the preparer's — refuse to delete.
        const frozen = (await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear)
          .query(`SELECT frozen FROM raul_tax_form_1040 WHERE owner_oid = @oid AND tax_year = @year;`))
          .recordset[0];
        if (frozen && frozen.frozen) {
          return {
            status: 409,
            jsonBody: { error: "This declaration was approved by your tax preparer and can't be deleted. Contact them to reopen it." },
          };
        }

        // Year-scoped documents (W-2/1099): blobs first, then rows+extractions.
        const cfg = getAppConfig(request.headers.get("x-app-id") || "raultax");
        const files = (await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear).query(`
            SELECT id, blob_name FROM raul_tax_files
            WHERE owner_oid = @oid AND tax_year = @year
              AND doc_type IN ('w2', 'form_1099');`)).recordset;
        for (const f of files) {
          await deleteBlob(cfg.container, f.blob_name).catch(() => {});
          await pool.request().input("id", sql.Int, f.id).query(`
            DELETE FROM raul_tax_file_extractions WHERE file_id = @id;
            DELETE FROM raul_tax_files WHERE id = @id;`);
        }

        // Cascade every per-year table, then the declaration itself.
        await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear).query(`
            DELETE FROM raul_tax_company_lines
            WHERE owner_oid = @oid AND company_id IN
              (SELECT id FROM raul_tax_companies WHERE owner_oid = @oid AND tax_year = @year);
            DELETE FROM raul_tax_companies    WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_jobs         WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_dependents   WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_care_providers WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_bank_accounts WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_spouse       WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_form_2441    WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_schedule1    WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_schedule_se  WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_form_1040    WHERE owner_oid = @oid AND tax_year = @year;
            DELETE FROM raul_tax_declarations WHERE owner_oid = @oid AND tax_year = @year;
          `);

        return { status: 200, jsonBody: { ok: true, deletedFiles: files.length } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("declarations failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
