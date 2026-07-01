-- Tax year on the document tables (files + extractions). Idempotent — safe to run
-- whether or not create_raul_tax_file_extractions.sql was run earlier.
-- tax_year is stamped automatically to the current year when a file is uploaded.

-- 1) Shared files table: add tax_year (NULLABLE so other apps on ksgpro-api are
--    unaffected; they simply never set it).
IF COL_LENGTH('dbo.raul_tax_files', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_files ADD tax_year INT NULL;

-- 2) Extractions table: create it (with tax_year) if it doesn't exist yet,
--    otherwise just add the tax_year column.
IF OBJECT_ID('dbo.raul_tax_file_extractions', 'U') IS NULL
BEGIN
    CREATE TABLE raul_tax_file_extractions (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        file_id      INT           NOT NULL UNIQUE,
        owner_oid    NVARCHAR(64)  NOT NULL,
        doc_type     NVARCHAR(64)  NULL,
        model        NVARCHAR(64)  NULL,
        status       NVARCHAR(32)  NOT NULL DEFAULT 'pending',
        fields_json  NVARCHAR(MAX) NULL,
        rich_json    NVARCHAR(MAX) NULL,
        tax_year     INT           NULL,
        error        NVARCHAR(512) NULL,
        created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX ix_raul_tax_file_extractions_owner ON raul_tax_file_extractions(owner_oid);
END
ELSE IF COL_LENGTH('dbo.raul_tax_file_extractions', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_file_extractions ADD tax_year INT NULL;
