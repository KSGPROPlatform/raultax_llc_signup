-- Phase 2: everything a declaration collects becomes PER TAX YEAR.
-- Adds tax_year to the per-year tables; existing rows are backfilled to 2025
-- (the current declarable year). The spouse table's one-per-user unique becomes
-- one-per-user-per-year. Idempotent. Run once against the raultax database.

IF COL_LENGTH('dbo.raul_tax_jobs', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_jobs          ADD tax_year INT NOT NULL DEFAULT 2025;
IF COL_LENGTH('dbo.raul_tax_dependents', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_dependents    ADD tax_year INT NOT NULL DEFAULT 2025;
IF COL_LENGTH('dbo.raul_tax_bank_accounts', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_bank_accounts ADD tax_year INT NOT NULL DEFAULT 2025;
IF COL_LENGTH('dbo.raul_tax_companies', 'tax_year') IS NULL
    ALTER TABLE dbo.raul_tax_companies     ADD tax_year INT NOT NULL DEFAULT 2025;
-- (raul_tax_company_lines needs no column: P&L lines are scoped through their
--  company_id, and each company row is now per-year.)

-- Spouse: one row per user per YEAR (was one per user).
IF COL_LENGTH('dbo.raul_tax_spouse', 'tax_year') IS NULL
BEGIN
    ALTER TABLE dbo.raul_tax_spouse ADD tax_year INT NOT NULL DEFAULT 2025;

    -- Drop the system-named UNIQUE(owner_oid) constraint...
    DECLARE @uq sysname;
    SELECT @uq = kc.name
    FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.raul_tax_spouse') AND kc.type = 'UQ';
    IF @uq IS NOT NULL
        EXEC('ALTER TABLE dbo.raul_tax_spouse DROP CONSTRAINT [' + @uq + ']');

    -- ...and replace it with one per (user, year).
    ALTER TABLE dbo.raul_tax_spouse
        ADD CONSTRAINT uq_raul_tax_spouse_year UNIQUE (owner_oid, tax_year);
END
