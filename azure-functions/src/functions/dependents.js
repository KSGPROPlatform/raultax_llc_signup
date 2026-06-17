const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/dependents — a raultax user's tax dependents (Form 2). Sensitive fields
// (ssn) live here, not in Entra. Every row is scoped by owner_oid (the Entra
// object id), so a caller can only ever touch their own rows.
//   GET    ?oid=                                                  -> list (newest first)
//   POST   { oid, id?, full_name, ssn, date_of_birth, relationship } -> insert, or owner-checked update when id is given
//   DELETE ?oid=&id=                                              -> owner-checked delete
app.http("dependents", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "dependents",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === "GET") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid).query(`
            SELECT id, owner_oid, full_name, ssn, date_of_birth, relationship,
                   created_at, updated_at
            FROM raul_tax_dependents
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
          .input("full_name", sql.NVarChar(256), b.full_name ?? "")
          .input("ssn", sql.NVarChar(32), b.ssn ?? "")
          .input("date_of_birth", sql.NVarChar(32), b.date_of_birth ?? "")
          .input("relationship", sql.NVarChar(64), b.relationship ?? "");

        const OUTPUT = `
          OUTPUT inserted.id, inserted.owner_oid, inserted.full_name, inserted.ssn,
                 inserted.date_of_birth, inserted.relationship,
                 inserted.created_at, inserted.updated_at`;

        if (b.id) {
          const result = await req.input("id", sql.Int, Number(b.id)).query(`
            UPDATE raul_tax_dependents
            SET full_name = @full_name, ssn = @ssn, date_of_birth = @date_of_birth,
                relationship = @relationship, updated_at = SYSUTCDATETIME()
            ${OUTPUT}
            WHERE id = @id AND owner_oid = @oid;
          `);
          if (!result.recordset.length) return { status: 404, jsonBody: { error: "Not found" } };
          return { status: 200, jsonBody: result.recordset[0] };
        }

        const result = await req.query(`
          INSERT INTO raul_tax_dependents (owner_oid, full_name, ssn, date_of_birth, relationship)
          ${OUTPUT}
          VALUES (@oid, @full_name, @ssn, @date_of_birth, @relationship);
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
            DELETE FROM raul_tax_dependents WHERE id = @id AND owner_oid = @oid;
          `);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("dependents failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
