-- Jobs split into two fields: the user's OCCUPATION and the COMPANY / employer
-- name — the company is what a W-2's employer / 1099's payer is verified
-- against. job_name is kept (legacy display); existing rows keep it as-is and
-- the new columns start empty (no company check until the user fills them).
-- Idempotent. Run once against the raultax database.

IF COL_LENGTH('dbo.raul_tax_jobs', 'occupation') IS NULL
    ALTER TABLE dbo.raul_tax_jobs ADD
        occupation   NVARCHAR(256) NOT NULL DEFAULT '',
        company_name NVARCHAR(256) NOT NULL DEFAULT '';
