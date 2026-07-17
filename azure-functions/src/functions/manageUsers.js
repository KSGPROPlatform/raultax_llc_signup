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
  methods: ["GET", "PATCH", "POST", "DELETE"],
  authLevel: "function",
  route: "manageUsers",
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      // PATCH { oid, role } — flip an account between user and reviewer.
      // 'admin' is deliberately NOT settable here (SQL-only, defense in depth).
      if (request.method === "PATCH") {
        const b = (await request.json().catch(() => ({}))) || {};
        if (!b.oid || !["user", "reviewer"].includes(b.role)) {
          return { status: 400, jsonBody: { error: "oid and role (user|reviewer) are required" } };
        }
        const r = await pool.request()
          .input("oid", sql.NVarChar(64), b.oid)
          .input("role", sql.NVarChar(20), b.role).query(`
            UPDATE raul_tax_users SET role = @role, updated_at = SYSUTCDATETIME()
            WHERE entra_object_id = @oid AND role <> 'admin';
            SELECT @@ROWCOUNT AS n;`);
        if (!r.recordset[0].n) return { status: 404, jsonBody: { error: "Not found (or admin)" } };
        return { status: 200, jsonBody: { ok: true } };
      }

      // POST { email, invitedBy } — invite a reviewer by email. If the account
      // already exists it's promoted immediately; otherwise the invite makes
      // the account a reviewer the moment that email signs up.
      if (request.method === "POST") {
        const b = (await request.json().catch(() => ({}))) || {};
        const email = String(b.email || "").trim().toLowerCase();
        if (!email) return { status: 400, jsonBody: { error: "email is required" } };
        const existing = (await pool.request()
          .input("email", sql.NVarChar(256), email)
          .query(`SELECT entra_object_id, role FROM raul_tax_users WHERE LOWER(email) = @email;`))
          .recordset[0];
        if (existing && existing.role === "admin") {
          return { status: 400, jsonBody: { error: "That account is an admin." } };
        }
        if (existing) {
          await pool.request().input("oid", sql.NVarChar(64), existing.entra_object_id).query(`
            UPDATE raul_tax_users SET role = 'reviewer', updated_at = SYSUTCDATETIME()
            WHERE entra_object_id = @oid;`);
          return { status: 200, jsonBody: { ok: true, promoted: true } };
        }
        await pool.request()
          .input("email", sql.NVarChar(256), email)
          .input("by", sql.NVarChar(64), b.invitedBy ?? null).query(`
            MERGE raul_tax_reviewer_invites AS t
            USING (SELECT @email AS email) AS s ON t.email = s.email
            WHEN NOT MATCHED THEN INSERT (email, invited_by) VALUES (@email, @by);`);
        return { status: 201, jsonBody: { ok: true, invited: true } };
      }

      // DELETE ?email= — withdraw a pending invite.
      if (request.method === "DELETE") {
        const email = String(request.query.get("email") || "").trim().toLowerCase();
        if (!email) return { status: 400, jsonBody: { error: "email is required" } };
        await pool.request().input("email", sql.NVarChar(256), email)
          .query(`DELETE FROM raul_tax_reviewer_invites WHERE LOWER(email) = @email;`);
        return { status: 200, jsonBody: { ok: true } };
      }

      const oid = request.query.get("oid");

      // GET ?invites=1 — pending reviewer invites (for the Team panel).
      if (request.query.get("invites")) {
        const inv = await pool.request().query(`
          SELECT email, invited_by, created_at FROM raul_tax_reviewer_invites ORDER BY created_at DESC;`);
        return { status: 200, jsonBody: inv.recordset };
      }

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
