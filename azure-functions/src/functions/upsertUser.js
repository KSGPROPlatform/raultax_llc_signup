const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");

// POST /api/upsertUser   body: { oid, email, name, ...profile }
// Mirrors an Entra user into raul_tax_users, keyed by the Entra object id (oid).
// Profile fields (first_name, ssn, address, etc.) are collected by our own
// sign-up form and stored here — they are NOT in Entra.
//
// New users default to role 'user'. On an existing row we keep the role and use
// COALESCE for profile fields, so a later SIGN-IN (which sends no profile) never
// wipes data captured at sign-up. Returns the saved row (including role).
app.http("upsertUser", {
  methods: ["POST"],
  authLevel: "function",
  route: "upsertUser",
  handler: async (request, context) => {
    try {
      const b = (await request.json().catch(() => ({}))) || {};
      if (!b.oid) {
        return { status: 400, jsonBody: { error: "oid is required" } };
      }

      const pool = await getPool();
      const result = await pool
        .request()
        .input("oid", sql.NVarChar(64), b.oid)
        .input("email", sql.NVarChar(256), b.email ?? null)
        .input("name", sql.NVarChar(256), b.name ?? null)
        .input("first_name", sql.NVarChar(128), b.first_name ?? null)
        .input("last_name", sql.NVarChar(128), b.last_name ?? null)
        .input("middle_name", sql.NVarChar(128), b.middle_name ?? null)
        .input("date_of_birth", sql.NVarChar(32), b.date_of_birth ?? null)
        .input("filing_status", sql.NVarChar(64), b.filing_status ?? null)
        .input("marital_status", sql.NVarChar(64), b.marital_status ?? null)
        .input("job_title", sql.NVarChar(128), b.job_title ?? null)
        .input("phone_number", sql.NVarChar(32), b.phone_number ?? null)
        .input("ssn", sql.NVarChar(32), b.ssn ?? null)
        .input("street_address", sql.NVarChar(256), b.street_address ?? null)
        .input("city", sql.NVarChar(128), b.city ?? null)
        .input("state_province", sql.NVarChar(128), b.state_province ?? null)
        .input("postal_code", sql.NVarChar(32), b.postal_code ?? null)
        // Onboarding flags: undefined => null => COALESCE keeps the existing value.
        .input("owns_establishment", sql.Bit, b.owns_establishment == null ? null : b.owns_establishment ? 1 : 0)
        .input("onboarding_completed", sql.Bit, b.onboarding_completed == null ? null : b.onboarding_completed ? 1 : 0).query(`
          MERGE raul_tax_users AS target
          USING (SELECT @oid AS entra_object_id) AS source
            ON target.entra_object_id = source.entra_object_id
          WHEN MATCHED THEN
            UPDATE SET
              email = @email,
              name = @name,
              first_name     = COALESCE(@first_name, first_name),
              last_name      = COALESCE(@last_name, last_name),
              middle_name    = COALESCE(@middle_name, middle_name),
              date_of_birth  = COALESCE(@date_of_birth, date_of_birth),
              filing_status  = COALESCE(@filing_status, filing_status),
              marital_status = COALESCE(@marital_status, marital_status),
              job_title      = COALESCE(@job_title, job_title),
              phone_number   = COALESCE(@phone_number, phone_number),
              ssn            = COALESCE(@ssn, ssn),
              street_address = COALESCE(@street_address, street_address),
              city           = COALESCE(@city, city),
              state_province = COALESCE(@state_province, state_province),
              postal_code    = COALESCE(@postal_code, postal_code),
              owns_establishment   = COALESCE(@owns_establishment, owns_establishment),
              onboarding_completed = COALESCE(@onboarding_completed, onboarding_completed),
              updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN
            INSERT (entra_object_id, email, name, role,
                    first_name, last_name, middle_name, date_of_birth, filing_status,
                    marital_status, job_title, phone_number, ssn,
                    street_address, city, state_province, postal_code,
                    owns_establishment, onboarding_completed,
                    created_at, updated_at)
            VALUES (@oid, @email, @name, 'user',
                    ISNULL(@first_name, ''), ISNULL(@last_name, ''), ISNULL(@middle_name, ''),
                    ISNULL(@date_of_birth, ''), ISNULL(@filing_status, ''),
                    ISNULL(@marital_status, ''), ISNULL(@job_title, ''),
                    ISNULL(@phone_number, ''), ISNULL(@ssn, ''),
                    ISNULL(@street_address, ''), ISNULL(@city, ''),
                    ISNULL(@state_province, ''), ISNULL(@postal_code, ''),
                    ISNULL(@owns_establishment, 0), ISNULL(@onboarding_completed, 0),
                    SYSUTCDATETIME(), SYSUTCDATETIME())
          OUTPUT inserted.id, inserted.entra_object_id, inserted.email,
                 inserted.name, inserted.role,
                 inserted.owns_establishment, inserted.onboarding_completed;
        `);

      return { status: 200, jsonBody: result.recordset[0] };
    } catch (err) {
      context.error("upsertUser failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
