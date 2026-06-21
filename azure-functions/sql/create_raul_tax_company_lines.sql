-- Per-company profit/loss line items (replaces the single business_expense
-- number). Net = SUM(income) - SUM(expense) is cached back onto
-- raul_tax_companies.business_expense by the companyLines function so the
-- admin view / companies list keep showing each company's P/L.
-- Run once against the raultax database.

CREATE TABLE raul_tax_company_lines (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64)  NOT NULL,          -- FK -> raul_tax_users.entra_object_id (scoping)
    company_id  INT           NOT NULL,          -- FK -> raul_tax_companies.id
    kind        NVARCHAR(16)  NOT NULL DEFAULT 'expense',  -- 'income' | 'expense'
    category    NVARCHAR(64)  NOT NULL DEFAULT '',
    description NVARCHAR(256) NOT NULL DEFAULT '',
    amount      DECIMAL(18,2) NOT NULL DEFAULT 0,          -- always positive; sign comes from kind
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_company_lines_company FOREIGN KEY (company_id)
        REFERENCES raul_tax_companies(id)
);
CREATE INDEX ix_raul_tax_company_lines_company ON raul_tax_company_lines(company_id);
