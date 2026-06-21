const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// Recompute a company's net P/L from its line items and cache it on the company
// row (so the dashboard/admin keep showing each company's P/L).
async function recomputeNet(pool, oid, companyId) {
  await pool
    .request()
    .input("oid", sql.NVarChar(64), oid)
    .input("cid", sql.Int, companyId).query(`
      UPDATE raul_tax_companies
      SET business_expense = (
            SELECT ISNULL(SUM(CASE WHEN kind = 'income' THEN amount ELSE -amount END), 0)
            FROM raul_tax_company_lines WHERE company_id = @cid AND owner_oid = @oid
          ),
          updated_at = SYSUTCDATETIME()
      WHERE id = @cid AND owner_oid = @oid;
    `);
}

// /api/companyLines — per-company profit/loss line items. Scoped by owner_oid.
//   GET    ?oid=&companyId=                                           -> list (oldest first)
//   POST   { oid, companyId, id?, kind, category, description, amount } -> insert / owner-checked update
//   DELETE ?oid=&id=                                                  -> owner-checked delete
app.http("companyLines", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "companyLines",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        const companyId = Number(request.query.get("companyId"));
        if (!oid || !Number.isInteger(companyId)) {
          return { status: 400, jsonBody: { error: "oid and companyId are required" } };
        }
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("cid", sql.Int, companyId).query(`
            SELECT id, owner_oid, company_id, kind, category, description, amount,
                   created_at, updated_at
            FROM raul_tax_company_lines
            WHERE owner_oid = @oid AND company_id = @cid
            ORDER BY id ASC;
          `);
        return { status: 200, jsonBody: result.recordset };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        const companyId = Number(b.companyId);
        if (!b.oid || !Number.isInteger(companyId)) {
          return { status: 400, jsonBody: { error: "oid and companyId are required" } };
        }
        const kind = b.kind === "income" ? "income" : "expense";
        const amount =
          b.amount === "" || b.amount == null ? 0 : Number(b.amount);
        const req = pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("cid", sql.Int, companyId)
          .input("kind", sql.NVarChar(16), kind)
          .input("category", sql.NVarChar(64), b.category ?? "")
          .input("description", sql.NVarChar(256), b.description ?? "")
          .input("amount", sql.Decimal(18, 2), Number.isFinite(amount) ? Math.abs(amount) : 0);

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.company_id, inserted.kind,
                 inserted.category, inserted.description, inserted.amount,
                 inserted.created_at, inserted.updated_at`;

        let row;
        if (b.id) {
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_company_lines
            SET kind = @kind, category = @category, description = @description,
                amount = @amount, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid AND company_id = @cid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          row = result.recordset[0];
        } else {
          const result = await req.query(`
            INSERT INTO raul_tax_company_lines (owner_oid, company_id, kind, category, description, amount)
            ${OUTPUT}
            VALUES (@oid, @cid, @kind, @category, @description, @amount);
          `);
          row = result.recordset[0];
        }
        await recomputeNet(pool, b.oid, companyId);
        return { status: b.id ? 200 : 201, jsonBody: row };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        const id = Number(request.query.get("id"));
        if (!oid || !Number.isInteger(id)) {
          return { status: 400, jsonBody: { error: "oid and id are required" } };
        }
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .input("id", sql.Int, id).query(`
            DELETE FROM raul_tax_company_lines
            OUTPUT deleted.company_id
            WHERE id = @id AND owner_oid = @oid;
          `);
        const companyId = result.recordset[0]?.company_id;
        if (companyId) await recomputeNet(pool, oid, companyId);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("companyLines failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
