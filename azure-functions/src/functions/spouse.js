const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// /api/spouse — a raultax user's spouse (ONE per user, keyed by owner_oid).
// Driven by the Form-1 filing status: full record for "Married filing jointly",
// SSN only for "Married filing separately". Sensitive fields (ssn) live here, not
// in Entra. Every query is scoped by owner_oid so a caller only touches their own.
//   GET    ?oid=                                  -> the spouse row, or null
//   POST   { oid, ...fields }                     -> upsert (absent fields are kept)
//   DELETE ?oid=                                  -> remove the spouse
const COLS = `id, owner_oid, first_name, last_name, date_of_birth, ssn,
              street_address, city, state_province, postal_code,
              created_at, updated_at`;

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
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .query(`SELECT ${COLS} FROM raul_tax_spouse WHERE owner_oid = @oid;`);
        return { status: 200, jsonBody: result.recordset[0] ?? null };
      }

      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid) return { status: 400, jsonBody: { error: "oid is required" } };
        // Pass null for absent fields so COALESCE keeps the stored value — this
        // lets the MFS "SSN only" save not wipe a previously-entered full record.
        const orNull = (v) => (typeof v === "string" ? v : null);
        const result = await pool
          .request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("first_name", sql.NVarChar(256), orNull(b.first_name))
          .input("last_name", sql.NVarChar(256), orNull(b.last_name))
          .input("date_of_birth", sql.NVarChar(32), orNull(b.date_of_birth))
          .input("ssn", sql.NVarChar(32), orNull(b.ssn))
          .input("street_address", sql.NVarChar(256), orNull(b.street_address))
          .input("city", sql.NVarChar(128), orNull(b.city))
          .input("state_province", sql.NVarChar(128), orNull(b.state_province))
          .input("postal_code", sql.NVarChar(16), orNull(b.postal_code)).query(`
            MERGE raul_tax_spouse AS t
            USING (SELECT @oid AS owner_oid) AS s ON t.owner_oid = s.owner_oid
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
              (owner_oid, first_name, last_name, date_of_birth, ssn,
               street_address, city, state_province, postal_code)
              VALUES (@oid, COALESCE(@first_name, ''), COALESCE(@last_name, ''),
                      COALESCE(@date_of_birth, ''), COALESCE(@ssn, ''),
                      COALESCE(@street_address, ''), COALESCE(@city, ''),
                      COALESCE(@state_province, ''), COALESCE(@postal_code, ''))
            OUTPUT inserted.id, inserted.owner_oid, inserted.first_name,
                   inserted.last_name, inserted.date_of_birth, inserted.ssn,
                   inserted.street_address, inserted.city, inserted.state_province,
                   inserted.postal_code, inserted.created_at, inserted.updated_at;
          `);
        return { status: 200, jsonBody: result.recordset[0] };
      }

      if (request.method === "DELETE") {
        const oid = request.query.get("oid");
        if (!oid) return { status: 400, jsonBody: { error: "oid is required" } };
        await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .query(`DELETE FROM raul_tax_spouse WHERE owner_oid = @oid;`);
        return { status: 200, jsonBody: { ok: true } };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      context.error("spouse failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
