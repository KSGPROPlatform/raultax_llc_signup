-- Spouse (filing-status driven) — ONE per user. Populated when the filing status
-- is "Married filing jointly" (full: name, DOB, SSN, address — the spouse SSN doc
-- is a raul_tax_files row tagged doc_type='spouse_ssn_copy') or "Married filing
-- separately" (SSN only). owner_oid is UNIQUE so each user has at most one spouse.
-- Run once against the raultax database.

CREATE TABLE raul_tax_spouse (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid       NVARCHAR(64)  NOT NULL UNIQUE,   -- FK -> raul_tax_users.entra_object_id
    first_name      NVARCHAR(256) NOT NULL DEFAULT '',
    last_name       NVARCHAR(256) NOT NULL DEFAULT '',
    date_of_birth   NVARCHAR(32)  NOT NULL DEFAULT '',
    ssn             NVARCHAR(32)  NOT NULL DEFAULT '',
    street_address  NVARCHAR(256) NOT NULL DEFAULT '',
    city            NVARCHAR(128) NOT NULL DEFAULT '',
    state_province  NVARCHAR(128) NOT NULL DEFAULT '',
    postal_code     NVARCHAR(16)  NOT NULL DEFAULT '',
    created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_spouse_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
