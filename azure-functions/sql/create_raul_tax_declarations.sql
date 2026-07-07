-- Tax declarations — one row per (user, tax year). The year is the primary
-- attribute of a filing: the user picks it first (onboarding Step 0 / dashboard
-- year picker) and everything captured afterwards belongs to that year's Form
-- 1040. Phase 1 scopes documents by year; later phases scope the other tables.
-- Run once against the raultax database.

CREATE TABLE raul_tax_declarations (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid  NVARCHAR(64) NOT NULL,        -- FK -> raul_tax_users.entra_object_id
    tax_year   INT          NOT NULL,
    status     NVARCHAR(16) NOT NULL DEFAULT 'draft',   -- draft | submitted (future)
    created_at DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_declarations_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id),
    CONSTRAINT uq_raul_tax_declarations UNIQUE (owner_oid, tax_year)
);
CREATE INDEX ix_raul_tax_declarations_owner ON raul_tax_declarations(owner_oid);
