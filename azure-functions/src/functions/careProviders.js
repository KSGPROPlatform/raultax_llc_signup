const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/careProviders — Form 2441 Part I care providers, PER TAX YEAR (the form
// makes Part I mandatory whenever dependent-care benefits or expenses exist).
// Every row is scoped by owner_oid so a caller only ever touches their own.
//   GET    ?oid=&taxYear=                       -> list (year-filtered when given)
//   POST   { oid, id?, provider_name, address, tax_id,
//            is_household_employee, amount_paid, tax_year }
//   DELETE ?oid=&id=
const FALLBACK_YEAR = () => new Date().getFullYear() - 1; // latest declarable year

app.http("careProviders", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "careProviders",
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
            SELECT id, owner_oid, provider_name, address, tax_id,
                   is_household_employee, amount_paid, tax_year, created_at, updated_at
            FROM raul_tax_care_providers
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
          .input("provider_name", sql.NVarChar(256), b.provider_name ?? "")
          .input("address", sql.NVarChar(512), b.address ?? "")
          .input("tax_id", sql.NVarChar(32), b.tax_id ?? "")
          .input("hh", sql.Bit, b.is_household_employee ? 1 : 0)
          .input("amount", sql.Decimal(18, 2), Number.isFinite(Number(b.amount_paid)) ? Number(b.amount_paid) : null)
          .input("year", sql.Int, year);

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.provider_name, inserted.address,
                 inserted.tax_id, inserted.is_household_employee, inserted.amount_paid,
                 inserted.tax_year, inserted.created_at, inserted.updated_at`;

        if (b.id) {
          // Updates keep the row's original year.
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_care_providers
            SET provider_name = @provider_name, address = @address, tax_id = @tax_id,
                is_household_employee = @hh, amount_paid = @amount, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_care_providers
            (owner_oid, provider_name, address, tax_id, is_household_employee, amount_paid, tax_year)
          ${OUTPUT}
          VALUES (@oid, @provider_name, @address, @tax_id, @hh, @amount, @year);
        `);
        return { status: 201, jsonBody: result.recordset[0] };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        const id = Number(request.query.get("id"));
        if (!oid || !Number.isInteger(id)) {
          return { status: 400, jsonBody: { error: "oid and id are required" } };
        }
        await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("id", sql.Int, id).query(`
            DELETE FROM raul_tax_care_providers WHERE id = @id AND owner_oid = @oid;
          `);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("careProviders failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
