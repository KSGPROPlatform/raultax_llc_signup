-- Phase 3: the 1040 facts that can CHANGE between years move onto the
-- declaration (filing status, marital status, home address) — a user can be
-- Single in 2023 and Married filing jointly in 2025. Identity (name, SSN, DOB,
-- phone) stays on raul_tax_users; the old user columns are kept as a fallback
-- and are NOT dropped. Existing declarations are backfilled from the profile.
-- Idempotent. Run once against the raultax database.

IF COL_LENGTH('dbo.raul_tax_declarations', 'filing_status') IS NULL
BEGIN
    ALTER TABLE dbo.raul_tax_declarations ADD
        filing_status  NVARCHAR(64)  NOT NULL DEFAULT '',
        marital_status NVARCHAR(64)  NOT NULL DEFAULT '',
        street_address NVARCHAR(256) NOT NULL DEFAULT '',
        city           NVARCHAR(128) NOT NULL DEFAULT '',
        state_province NVARCHAR(128) NOT NULL DEFAULT '',
        postal_code    NVARCHAR(32)  NOT NULL DEFAULT '';
END

-- Backfill (dynamic SQL so it parses even in the same batch as the ALTER).
-- Only fills declarations whose fields are still empty.
EXEC('
UPDATE d SET
    filing_status  = CASE WHEN d.filing_status  = '''' THEN COALESCE(u.filing_status,  '''') ELSE d.filing_status  END,
    marital_status = CASE WHEN d.marital_status = '''' THEN COALESCE(u.marital_status, '''') ELSE d.marital_status END,
    street_address = CASE WHEN d.street_address = '''' THEN COALESCE(u.street_address, '''') ELSE d.street_address END,
    city           = CASE WHEN d.city           = '''' THEN COALESCE(u.city,           '''') ELSE d.city           END,
    state_province = CASE WHEN d.state_province = '''' THEN COALESCE(u.state_province, '''') ELSE d.state_province END,
    postal_code    = CASE WHEN d.postal_code    = '''' THEN COALESCE(u.postal_code,    '''') ELSE d.postal_code    END
FROM dbo.raul_tax_declarations d
JOIN dbo.raul_tax_users u ON u.entra_object_id = d.owner_oid;
');
