const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// GET /api/manageUsers            -> all users + per-user record counts (overview)
// GET /api/manageUsers?oid=<oid>  -> one user's full profile + dependents, bank
//                                    accounts, companies and files (detail)
//
// NB: the route must NOT start with "admin" — Azure Functions reserves the
// `admin` route prefix and rejects such functions ("route conflicts with a
// built-in route"), so this is named manageUsers, not adminUsers.
//
// raultax-specific. Called server-to-server by the admin-only app route, which
// enforces the admin role; this function is only the data source.
app.http("manageUsers", {
  methods: ["GET"],
  authLevel: "function",
  route: "manageUsers",
  handler: async (request, context) => {
    try {
      const pool = await getPool();
      const oid = request.query.get("oid");

      if (oid) {
        const userRes = await pool
          .request()
          .input("oid", sql.NVarChar(64), oid)
          .query(`SELECT * FROM raul_tax_users WHERE entra_object_id = @oid;`);
        const user = userRes.recordset[0];
        if (!user) return { status: 404, jsonBody: { error: "Not found" } };

        const q = (text) =>
          pool.request().input("oid", sql.NVarChar(64), oid).query(text);

        const dependents = (
          await q(`SELECT id, full_name, ssn, date_of_birth, relationship
                   FROM raul_tax_dependents WHERE owner_oid = @oid ORDER BY id DESC;`)
        ).recordset;
        const bankAccounts = (
          await q(`SELECT id, bank_name, account_number, routing_number
                   FROM raul_tax_bank_accounts WHERE owner_oid = @oid ORDER BY id DESC;`)
        ).recordset;
        const companies = (
          await q(`SELECT id, company_name, ein, activities, business_expense
                   FROM raul_tax_companies WHERE owner_oid = @oid ORDER BY id DESC;`)
        ).recordset;
        const files = (
          await q(`SELECT id, original_name, content_type, size_bytes, doc_type, uploaded_at
                   FROM raul_tax_files WHERE owner_oid = @oid ORDER BY uploaded_at DESC;`)
        ).recordset;

        return { status: 200, jsonBody: { user, dependents, bankAccounts, companies, files } };
      }

      // Overview — every user with counts of their related records.
      const result = await pool.request().query(`
        SELECT u.entra_object_id, u.name, u.email, u.role, u.created_at,
               u.onboarding_completed, u.owns_establishment,
               (SELECT COUNT(*) FROM raul_tax_dependents d   WHERE d.owner_oid = u.entra_object_id) AS dependents,
               (SELECT COUNT(*) FROM raul_tax_companies c    WHERE c.owner_oid = u.entra_object_id) AS companies,
               (SELECT COUNT(*) FROM raul_tax_bank_accounts b WHERE b.owner_oid = u.entra_object_id) AS bank_accounts,
               (SELECT COUNT(*) FROM raul_tax_files f         WHERE f.owner_oid = u.entra_object_id) AS documents
        FROM raul_tax_users u
        ORDER BY u.created_at DESC;
      `);

      return { status: 200, jsonBody: { users: result.recordset } };
    } catch (err) {
      context.error("manageUsers failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
