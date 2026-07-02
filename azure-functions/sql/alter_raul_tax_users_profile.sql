-- Add the profile columns to raul_tax_users.
-- All NOT NULL except middle_name (the only optional field).
-- Run ONE of the two options below depending on the table's current state.
-- NOTE: job_title was later DROPPED (the field was removed from Form 1); it is
-- intentionally absent below so re-running this can't reintroduce it.

-- =====================================================================
-- OPTION B — the columns do NOT exist yet (you hit the "can't be null"
-- error before, so this is most likely you). NOT NULL DEFAULT '' lets
-- SQL Server add them to the non-empty table (existing rows get '').
-- =====================================================================
ALTER TABLE dbo.raul_tax_users ADD
  first_name      NVARCHAR(128) NOT NULL DEFAULT '',
  last_name       NVARCHAR(128) NOT NULL DEFAULT '',
  middle_name     NVARCHAR(128) NULL,                  -- optional
  date_of_birth   NVARCHAR(32)  NOT NULL DEFAULT '',
  filing_status   NVARCHAR(64)  NOT NULL DEFAULT '',
  marital_status  NVARCHAR(64)  NOT NULL DEFAULT '',
  phone_number    NVARCHAR(32)  NOT NULL DEFAULT '',
  ssn             NVARCHAR(32)  NOT NULL DEFAULT '',
  street_address  NVARCHAR(256) NOT NULL DEFAULT '',
  city            NVARCHAR(128) NOT NULL DEFAULT '',
  state_province  NVARCHAR(128) NOT NULL DEFAULT '',
  postal_code     NVARCHAR(32)  NOT NULL DEFAULT '';

-- =====================================================================
-- OPTION A — the columns ALREADY exist as nullable (you ran the earlier
-- nullable ADD). Backfill NULLs, then enforce NOT NULL. Uncomment & run.
-- =====================================================================
-- UPDATE dbo.raul_tax_users SET
--   first_name=ISNULL(first_name,''),     last_name=ISNULL(last_name,''),
--   date_of_birth=ISNULL(date_of_birth,''),
--   filing_status=ISNULL(filing_status,''), marital_status=ISNULL(marital_status,''),
--   phone_number=ISNULL(phone_number,''),
--   ssn=ISNULL(ssn,''),                    street_address=ISNULL(street_address,''),
--   city=ISNULL(city,''),                  state_province=ISNULL(state_province,''),
--   postal_code=ISNULL(postal_code,'');
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN first_name     NVARCHAR(128) NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN last_name      NVARCHAR(128) NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN date_of_birth  NVARCHAR(32)  NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN filing_status  NVARCHAR(64)  NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN marital_status NVARCHAR(64)  NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN phone_number   NVARCHAR(32)  NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN ssn            NVARCHAR(32)  NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN street_address NVARCHAR(256) NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN city           NVARCHAR(128) NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN state_province NVARCHAR(128) NOT NULL;
-- ALTER TABLE dbo.raul_tax_users ALTER COLUMN postal_code    NVARCHAR(32)  NOT NULL;
-- (middle_name stays nullable.)
