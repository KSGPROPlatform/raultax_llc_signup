-- Profile onboarding forms 2-4 for raultax.
-- Three per-user child tables (keyed by owner_oid -> raul_tax_users.entra_object_id,
-- same pattern as raul_tax_files) plus two flags on the user row.
-- Run once against the raultax database.

-- Form 2: Dependents (one-to-many).
CREATE TABLE raul_tax_dependents (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid      NVARCHAR(64)  NOT NULL,          -- FK -> raul_tax_users.entra_object_id
    full_name      NVARCHAR(256) NOT NULL DEFAULT '',
    ssn            NVARCHAR(32)  NOT NULL DEFAULT '',   -- sensitive
    date_of_birth  NVARCHAR(32)  NOT NULL DEFAULT '',
    relationship   NVARCHAR(64)  NOT NULL DEFAULT '',
    created_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_dependents_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
CREATE INDEX ix_raul_tax_dependents_owner ON raul_tax_dependents(owner_oid);

-- Form 3: Bank accounts (one-to-many).
CREATE TABLE raul_tax_bank_accounts (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid       NVARCHAR(64)  NOT NULL,         -- FK -> raul_tax_users.entra_object_id
    bank_name       NVARCHAR(128) NOT NULL DEFAULT '',
    account_number  NVARCHAR(64)  NOT NULL DEFAULT '',   -- sensitive
    routing_number  NVARCHAR(32)  NOT NULL DEFAULT '',   -- sensitive
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_bank_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
CREATE INDEX ix_raul_tax_bank_owner ON raul_tax_bank_accounts(owner_oid);

-- Form 4: Companies / establishments (one-to-many).
CREATE TABLE raul_tax_companies (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid         NVARCHAR(64)  NOT NULL,       -- FK -> raul_tax_users.entra_object_id
    company_name      NVARCHAR(256) NOT NULL DEFAULT '',
    ein               NVARCHAR(16)  NOT NULL DEFAULT '',
    activities        NVARCHAR(256) NOT NULL DEFAULT '',
    business_expense  DECIMAL(18,2) NULL,           -- profit/loss, may be negative
    created_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_companies_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
CREATE INDEX ix_raul_tax_companies_owner ON raul_tax_companies(owner_oid);

-- User-level flags: the "do you own an establishment?" answer and the
-- onboarding-journey gate (drives the post-sign-up /onboarding redirect).
ALTER TABLE dbo.raul_tax_users ADD
  owns_establishment   BIT NOT NULL DEFAULT 0,
  onboarding_completed BIT NOT NULL DEFAULT 0;
