-- Jobs (Form: "Jobs") — one user has many jobs. Each job's W-2 / 1099 are stored
-- as files in raul_tax_files tagged with doc_type ('w2' / 'form_1099') AND the
-- job_id added below. Run once against the raultax database.

CREATE TABLE raul_tax_jobs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid   NVARCHAR(64)  NOT NULL,          -- FK -> raul_tax_users.entra_object_id
    job_name    NVARCHAR(256) NOT NULL DEFAULT '',
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_jobs_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);
CREATE INDEX ix_raul_tax_jobs_owner ON raul_tax_jobs(owner_oid);

-- Optional link from a stored file to a job (W-2 / 1099 per job). NULL = the
-- file isn't tied to a specific job (e.g. the SSN document).
ALTER TABLE dbo.raul_tax_files ADD job_id INT NULL;
