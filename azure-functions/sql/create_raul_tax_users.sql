-- Run this once in the Azure portal: your SQL database -> Query editor.
-- Creates the profile-mirror table. No password is ever stored here.
CREATE TABLE raul_tax_users (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    entra_object_id  NVARCHAR(64)  NOT NULL UNIQUE,   -- the Entra `oid` claim (link to Microsoft)
    email            NVARCHAR(256) NULL,
    name             NVARCHAR(256) NULL,
    tenant_id        NVARCHAR(64)  NULL,               -- the `tid` claim
    role             NVARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT chk_raul_tax_users_role CHECK (role IN ('user', 'admin'))
);

-- After you sign in once, make yourself an admin to test the admin dashboard:
-- UPDATE raul_tax_users SET role = 'admin' WHERE email = 'petzyrockchendi@gmail.com';
