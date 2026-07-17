-- Reviewer role (staff working under the admin): the admin invites them by
-- email / promotes accounts, assigns submitted declarations to them, and they
-- review + approve. Run ALL THREE blocks against the raultax database BEFORE
-- the functions deploy.

-- 1) Allow the new role value.
ALTER TABLE raul_tax_users DROP CONSTRAINT chk_raul_tax_users_role;
ALTER TABLE raul_tax_users ADD CONSTRAINT chk_raul_tax_users_role
    CHECK (role IN ('user', 'reviewer', 'admin'));

-- 2) Reviewer invitations: when this email signs up through the normal login,
--    the account is created as a reviewer automatically ("admin creates the
--    user" — the password stays with the person, in Entra).
CREATE TABLE raul_tax_reviewer_invites (
    email      NVARCHAR(256) NOT NULL PRIMARY KEY,
    invited_by NVARCHAR(64)  NULL,   -- admin oid
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 3) Assignment: which reviewer a declaration is handed to.
ALTER TABLE raul_tax_declarations ADD assigned_reviewer_oid NVARCHAR(64) NULL;
