-- Form 1040 computation tables (v1) — one row per declaration, one column per
-- agreed line (see docs/1040-mapping.md). NULL = never computed/collected;
-- 0 = known zero. DECIMAL(18,2), negatives allowed (e.g. line_1f, line_7a).
-- The 1040 row carries flags (JSON), preparer overrides (JSON) and freeze
-- state; schedule rows are pure computation shadows.
-- Run once against the raultax database.

CREATE TABLE raul_tax_form_1040 (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64) NOT NULL,   -- FK -> raul_tax_users.entra_object_id
    tax_year    INT          NOT NULL,
    -- Line 1 (wages)
    line_1a DECIMAL(18,2) NULL, line_1b DECIMAL(18,2) NULL, line_1c DECIMAL(18,2) NULL,
    line_1d DECIMAL(18,2) NULL, line_1e DECIMAL(18,2) NULL, line_1f DECIMAL(18,2) NULL,
    line_1g DECIMAL(18,2) NULL, line_1h DECIMAL(18,2) NULL, line_1i DECIMAL(18,2) NULL,
    line_1z DECIMAL(18,2) NULL,
    -- Lines 2-7 (parked columns; formulas later)
    line_2a DECIMAL(18,2) NULL, line_2b DECIMAL(18,2) NULL,
    line_3a DECIMAL(18,2) NULL, line_3b DECIMAL(18,2) NULL,
    line_4a DECIMAL(18,2) NULL, line_4b DECIMAL(18,2) NULL,
    line_5a DECIMAL(18,2) NULL, line_5b DECIMAL(18,2) NULL,
    line_6a DECIMAL(18,2) NULL, line_6b DECIMAL(18,2) NULL,
    line_7a DECIMAL(18,2) NULL,
    -- Income totals / AGI
    line_8 DECIMAL(18,2) NULL, line_9 DECIMAL(18,2) NULL, line_10 DECIMAL(18,2) NULL,
    line_11a DECIMAL(18,2) NULL, line_11b DECIMAL(18,2) NULL,
    -- Tax and credits
    line_12e DECIMAL(18,2) NULL, line_13a DECIMAL(18,2) NULL, line_13b DECIMAL(18,2) NULL,
    line_14 DECIMAL(18,2) NULL, line_15 DECIMAL(18,2) NULL, line_16 DECIMAL(18,2) NULL,
    line_17 DECIMAL(18,2) NULL, line_18 DECIMAL(18,2) NULL, line_19 DECIMAL(18,2) NULL,
    line_20 DECIMAL(18,2) NULL, line_21 DECIMAL(18,2) NULL, line_22 DECIMAL(18,2) NULL,
    line_23 DECIMAL(18,2) NULL, line_24 DECIMAL(18,2) NULL,
    -- Payments & refundable credits
    line_25a DECIMAL(18,2) NULL, line_25b DECIMAL(18,2) NULL, line_25c DECIMAL(18,2) NULL,
    line_25d DECIMAL(18,2) NULL, line_26 DECIMAL(18,2) NULL, line_27a DECIMAL(18,2) NULL,
    line_28 DECIMAL(18,2) NULL, line_29 DECIMAL(18,2) NULL, line_30 DECIMAL(18,2) NULL,
    line_31 DECIMAL(18,2) NULL, line_32 DECIMAL(18,2) NULL, line_33 DECIMAL(18,2) NULL,
    -- Refund / amount owed
    line_34 DECIMAL(18,2) NULL, line_35a DECIMAL(18,2) NULL, line_36 DECIMAL(18,2) NULL,
    line_37 DECIMAL(18,2) NULL, line_38 DECIMAL(18,2) NULL,
    -- Bookkeeping
    flags       NVARCHAR(MAX) NULL,     -- JSON array of preparer-attention items
    overrides   NVARCHAR(MAX) NULL,     -- JSON { line_x: { value, by, at } }
    frozen      BIT NOT NULL DEFAULT 0, -- set at submit/approval; stops recompute
    computed_at DATETIME2 NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_form_1040_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id),
    CONSTRAINT uq_raul_tax_form_1040 UNIQUE (owner_oid, tax_year)
);
CREATE INDEX ix_raul_tax_form_1040_owner ON raul_tax_form_1040(owner_oid);

CREATE TABLE raul_tax_schedule1 (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64) NOT NULL,
    tax_year    INT          NOT NULL,
    -- Part I: additional income
    s1_1 DECIMAL(18,2) NULL, s1_2a DECIMAL(18,2) NULL, s1_3 DECIMAL(18,2) NULL,
    s1_4 DECIMAL(18,2) NULL, s1_5 DECIMAL(18,2) NULL, s1_6 DECIMAL(18,2) NULL,
    s1_7 DECIMAL(18,2) NULL,
    s1_8a DECIMAL(18,2) NULL, s1_8b DECIMAL(18,2) NULL, s1_8c DECIMAL(18,2) NULL,
    s1_8d DECIMAL(18,2) NULL, s1_8e DECIMAL(18,2) NULL, s1_8f DECIMAL(18,2) NULL,
    s1_8g DECIMAL(18,2) NULL, s1_8h DECIMAL(18,2) NULL, s1_8i DECIMAL(18,2) NULL,
    s1_8j DECIMAL(18,2) NULL, s1_8k DECIMAL(18,2) NULL, s1_8l DECIMAL(18,2) NULL,
    s1_8m DECIMAL(18,2) NULL, s1_8n DECIMAL(18,2) NULL, s1_8o DECIMAL(18,2) NULL,
    s1_8p DECIMAL(18,2) NULL, s1_8q DECIMAL(18,2) NULL, s1_8r DECIMAL(18,2) NULL,
    s1_8s DECIMAL(18,2) NULL, s1_8t DECIMAL(18,2) NULL, s1_8u DECIMAL(18,2) NULL,
    s1_8v DECIMAL(18,2) NULL, s1_8z DECIMAL(18,2) NULL,
    s1_9 DECIMAL(18,2) NULL, s1_10 DECIMAL(18,2) NULL,
    -- Part II: adjustments to income
    s1_11 DECIMAL(18,2) NULL, s1_12 DECIMAL(18,2) NULL, s1_13 DECIMAL(18,2) NULL,
    s1_14 DECIMAL(18,2) NULL, s1_15 DECIMAL(18,2) NULL, s1_16 DECIMAL(18,2) NULL,
    s1_17 DECIMAL(18,2) NULL, s1_18 DECIMAL(18,2) NULL, s1_19a DECIMAL(18,2) NULL,
    s1_20 DECIMAL(18,2) NULL, s1_21 DECIMAL(18,2) NULL, s1_23 DECIMAL(18,2) NULL,
    s1_24a DECIMAL(18,2) NULL, s1_24b DECIMAL(18,2) NULL, s1_24c DECIMAL(18,2) NULL,
    s1_24d DECIMAL(18,2) NULL, s1_24e DECIMAL(18,2) NULL, s1_24f DECIMAL(18,2) NULL,
    s1_24g DECIMAL(18,2) NULL, s1_24h DECIMAL(18,2) NULL, s1_24i DECIMAL(18,2) NULL,
    s1_24j DECIMAL(18,2) NULL, s1_24k DECIMAL(18,2) NULL, s1_24z DECIMAL(18,2) NULL,
    s1_25 DECIMAL(18,2) NULL, s1_26 DECIMAL(18,2) NULL,
    computed_at DATETIME2 NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_schedule1_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id),
    CONSTRAINT uq_raul_tax_schedule1 UNIQUE (owner_oid, tax_year)
);
CREATE INDEX ix_raul_tax_schedule1_owner ON raul_tax_schedule1(owner_oid);

CREATE TABLE raul_tax_schedule_se (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64) NOT NULL,
    tax_year    INT          NOT NULL,
    se_1a DECIMAL(18,2) NULL, se_1b DECIMAL(18,2) NULL, se_2 DECIMAL(18,2) NULL,
    se_3 DECIMAL(18,2) NULL, se_4a DECIMAL(18,2) NULL, se_4b DECIMAL(18,2) NULL,
    se_4c DECIMAL(18,2) NULL, se_5a DECIMAL(18,2) NULL, se_5b DECIMAL(18,2) NULL,
    se_6 DECIMAL(18,2) NULL, se_8a DECIMAL(18,2) NULL, se_8b DECIMAL(18,2) NULL,
    se_8c DECIMAL(18,2) NULL, se_8d DECIMAL(18,2) NULL, se_9 DECIMAL(18,2) NULL,
    se_10 DECIMAL(18,2) NULL, se_11 DECIMAL(18,2) NULL, se_12 DECIMAL(18,2) NULL,
    se_13 DECIMAL(18,2) NULL, se_15 DECIMAL(18,2) NULL, se_17 DECIMAL(18,2) NULL,
    computed_at DATETIME2 NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_schedule_se_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id),
    CONSTRAINT uq_raul_tax_schedule_se UNIQUE (owner_oid, tax_year)
);
CREATE INDEX ix_raul_tax_schedule_se_owner ON raul_tax_schedule_se(owner_oid);
