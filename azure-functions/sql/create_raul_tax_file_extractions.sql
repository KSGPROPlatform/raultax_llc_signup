-- Document Intelligence extractions — ONE per uploaded file. Populated
-- automatically after upload by the analyzeDocument function: the file is sent to
-- the matching Azure Document Intelligence prebuilt model and the structured
-- fields are stored here (fields_json = flat key/value we consume later,
-- rich_json = per-field value + confidence). Kept in its own table so the SHARED
-- files table (raul_tax_files, used by other apps on ksgpro-api) is untouched.
-- Run once against the raultax database.

CREATE TABLE raul_tax_file_extractions (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    file_id      INT           NOT NULL UNIQUE,     -- raul_tax_files.id
    owner_oid    NVARCHAR(64)  NOT NULL,            -- raul_tax_users.entra_object_id
    doc_type     NVARCHAR(64)  NULL,
    model        NVARCHAR(64)  NULL,                -- the DI model used
    status       NVARCHAR(32)  NOT NULL DEFAULT 'pending', -- pending|done|unsupported|error
    fields_json  NVARCHAR(MAX) NULL,                -- flat { key: value }
    rich_json    NVARCHAR(MAX) NULL,                -- { key: { value, confidence } }
    error        NVARCHAR(512) NULL,
    created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_raul_tax_file_extractions_owner ON raul_tax_file_extractions(owner_oid);
