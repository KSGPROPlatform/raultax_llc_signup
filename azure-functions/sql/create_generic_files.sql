-- Generic per-user file table for an app onboarding to the shared ksgpro-api.
-- Replace <app>_files / <app>_users to match APP_REGISTRY.filesTable / usersTable.
-- (Identical shape to create_raul_tax_files.sql — only the names differ, which is
--  why parameterizing the table name is enough for the file functions to reuse.)
CREATE TABLE <app>_files (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid      NVARCHAR(64)  NOT NULL,
    blob_name      NVARCHAR(512) NOT NULL UNIQUE,
    original_name  NVARCHAR(256) NOT NULL,
    content_type   NVARCHAR(128) NULL,
    size_bytes     BIGINT        NULL,          -- original size
    stored_bytes   BIGINT        NULL,          -- size in Blob (after gzip, if any)
    is_compressed  BIT           NOT NULL DEFAULT 0,
    doc_type       NVARCHAR(64)  NULL,             -- optional category (Form 5)
    uploaded_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_<app>_files_user FOREIGN KEY (owner_oid)
        REFERENCES <app>_users(entra_object_id)
);

CREATE INDEX ix_<app>_files_owner ON <app>_files(owner_oid);
