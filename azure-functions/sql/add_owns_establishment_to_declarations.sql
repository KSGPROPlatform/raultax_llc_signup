-- The "do you own an establishment?" answer becomes PER TAX YEAR (you can have
-- a business one year and not the next). NULL = not asked yet, 0 = answered No
-- (counts the Business section as complete), 1 = answered Yes. Years that
-- already have companies are backfilled to Yes. Idempotent.

IF COL_LENGTH('dbo.raul_tax_declarations', 'owns_establishment') IS NULL
BEGIN
    ALTER TABLE dbo.raul_tax_declarations ADD owns_establishment BIT NULL;

    EXEC('
    UPDATE d SET owns_establishment = 1
    FROM dbo.raul_tax_declarations d
    WHERE EXISTS (SELECT 1 FROM dbo.raul_tax_companies c
                  WHERE c.owner_oid = d.owner_oid AND c.tax_year = d.tax_year);
    ');
END
