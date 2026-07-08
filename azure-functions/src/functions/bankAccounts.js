const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/bankAccounts — a raultax user's bank accounts (Form 3), PER TAX YEAR.
// account_number / routing_number are sensitive and live here, not in Entra.
//   GET    ?oid=&taxYear=                                     -> list (year-filtered when given)
//   POST   { oid, id?, bank_name, account_number, routing_number, tax_year } -> insert, or owner-checked update when id is given
//   DELETE ?oid=&id=                                          -> owner-checked delete
const FALLBACK_YEAR = () => new Date().getFullYear() - 1; // latest declarable year

app.http("bankAccounts", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "bankAccounts",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const taxYear = Number(request.query.get("taxYear"));
        const req = pool.request().input("oid", sql.NVarChar(64), oid);
        let where = "owner_oid = @oid";
        if (Number.isInteger(taxYear)) {
          req.input("year", sql.Int, taxYear);
          where += " AND tax_year = @year";
        }
        const result = await req.query(`
            SELECT id, owner_oid, bank_name, account_number, routing_number,
                   tax_year, created_at, updated_at
            FROM raul_tax_bank_accounts
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
          .input("bank_name", sql.NVarChar(128), b.bank_name ?? "")
          .input("account_number", sql.NVarChar(64), b.account_number ?? "")
          .input("routing_number", sql.NVarChar(32), b.routing_number ?? "")
          .input("year", sql.Int, year);

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.bank_name,
                 inserted.account_number, inserted.routing_number,
                 inserted.tax_year, inserted.created_at, inserted.updated_at`;

        if (b.id) {
          // Updates keep the row's original year.
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_bank_accounts
            SET bank_name = @bank_name, account_number = @account_number,
                routing_number = @routing_number, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_bank_accounts (owner_oid, bank_name, account_number, routing_number, tax_year)
          ${OUTPUT}
          VALUES (@oid, @bank_name, @account_number, @routing_number, @year);
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
            DELETE FROM raul_tax_bank_accounts WHERE id = @id AND owner_oid = @oid;
          `);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("bankAccounts failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
