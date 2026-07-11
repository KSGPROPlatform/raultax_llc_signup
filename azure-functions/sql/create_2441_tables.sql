-- Form 2441 (Child & Dependent Care) — computation shadow + care providers,
-- plus the new inputs on dependents/spouse. See docs/1040-mapping.md
-- ("Form 2441 module"). Run ALL FOUR blocks against the raultax database
-- BEFORE the functions deploy.

-- 1) One computed 2441 row per declaration (same pattern as the schedules).
CREATE TABLE raul_tax_form_2441 (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64) NOT NULL,
    tax_year    INT          NOT NULL,
    -- Part II (credit)
    f2441_3  DECIMAL(18,2) NULL, f2441_4  DECIMAL(18,2) NULL, f2441_5  DECIMAL(18,2) NULL,
    f2441_6  DECIMAL(18,2) NULL, f2441_7  DECIMAL(18,2) NULL, f2441_8  DECIMAL(9,4)  NULL,
    f2441_9a DECIMAL(18,2) NULL, f2441_9c DECIMAL(18,2) NULL, f2441_10 DECIMAL(18,2) NULL,
    f2441_11 DECIMAL(18,2) NULL,
    -- Part III (dependent care benefits)
    f2441_12 DECIMAL(18,2) NULL, f2441_15 DECIMAL(18,2) NULL, f2441_16 DECIMAL(18,2) NULL,
    f2441_17 DECIMAL(18,2) NULL, f2441_18 DECIMAL(18,2) NULL, f2441_19 DECIMAL(18,2) NULL,
    f2441_20 DECIMAL(18,2) NULL, f2441_21 DECIMAL(18,2) NULL, f2441_23 DECIMAL(18,2) NULL,
    f2441_24 DECIMAL(18,2) NULL, f2441_25 DECIMAL(18,2) NULL, f2441_26 DECIMAL(18,2) NULL,
    f2441_27 DECIMAL(18,2) NULL, f2441_28 DECIMAL(18,2) NULL, f2441_29 DECIMAL(18,2) NULL,
    f2441_30 DECIMAL(18,2) NULL, f2441_31 DECIMAL(18,2) NULL,
    computed_at DATETIME2 NULL,
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_form_2441_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id),
    CONSTRAINT uq_raul_tax_form_2441 UNIQUE (owner_oid, tax_year)
);
CREATE INDEX ix_raul_tax_form_2441_owner ON raul_tax_form_2441(owner_oid);

-- 2) Care providers (Form 2441 Part I — mandatory when the form applies).
CREATE TABLE raul_tax_care_providers (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid             NVARCHAR(64)  NOT NULL,
    tax_year              INT           NOT NULL,
    provider_name         NVARCHAR(256) NOT NULL,
    address               NVARCHAR(512) NULL,
    tax_id                NVARCHAR(32)  NULL,   -- SSN or EIN
    is_household_employee BIT           NOT NULL DEFAULT 0,
    amount_paid           DECIMAL(18,2) NULL,
    created_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_care_providers_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
CREATE INDEX ix_raul_tax_care_providers_owner ON raul_tax_care_providers(owner_oid);

-- 3) Per-dependent 2441 inputs: qualified expenses + the form 2(c) disabled box.
ALTER TABLE raul_tax_dependents ADD
    care_expenses DECIMAL(18,2) NULL,
    is_disabled   BIT NOT NULL DEFAULT 0;

-- 4) Spouse earned income (Form 2441 lines 5/19 — MFJ).
ALTER TABLE raul_tax_spouse ADD earned_income DECIMAL(18,2) NULL;
