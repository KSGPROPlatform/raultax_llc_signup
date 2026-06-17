const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/companies — a raultax user's companies / establishments (Form 4). Scoped
// by owner_oid. business_expense is a profit/loss amount (may be negative).
//   GET    ?oid=                                                       -> list (newest first)
//   POST   { oid, id?, company_name, ein, activities, business_expense } -> insert, or owner-checked update when id is given
//   DELETE ?oid=&id=                                                   -> owner-checked delete
app.http("companies", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "companies",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid).query(`
            SELECT id, owner_oid, company_name, ein, activities, business_expense,
                   created_at, updated_at
            FROM raul_tax_companies
            WHERE owner_oid = @oid
            ORDER BY id DESC;
          `);
        return { status: 200, jsonBody: result.recordset };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const expense =
          b.business_expense === "" || b.business_expense == null
            ? null
            : Number(b.business_expense);
        const req = pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("company_name", sql.NVarChar(256), b.company_name ?? "")
          .input("ein", sql.NVarChar(16), b.ein ?? "")
          .input("activities", sql.NVarChar(256), b.activities ?? "")
          .input("business_expense", sql.Decimal(18, 2), Number.isFinite(expense) ? expense : null);

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.company_name, inserted.ein,
                 inserted.activities, inserted.business_expense,
                 inserted.created_at, inserted.updated_at`;

        if (b.id) {
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_companies
            SET company_name = @company_name, ein = @ein, activities = @activities,
                business_expense = @business_expense, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_companies (owner_oid, company_name, ein, activities, business_expense)
          ${OUTPUT}
          VALUES (@oid, @company_name, @ein, @activities, @business_expense);
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
            DELETE FROM raul_tax_companies WHERE id = @id AND owner_oid = @oid;
          `);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("companies failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
