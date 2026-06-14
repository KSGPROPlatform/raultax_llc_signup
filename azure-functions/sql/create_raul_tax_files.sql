-- Run once in the Azure portal: ksgdatabase -> Query editor.
-- Tracks per-user file uploads. Bytes live in Blob (democontainer); this row is
-- the source of truth for ownership + whether the blob is gzip-compressed.
CREATE TABLE raul_tax_files (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    owner_oid      NVARCHAR(64)  NOT NULL,          -- Entra oid -> raul_tax_users.entra_object_id
    blob_name      NVARCHAR(512) NOT NULL UNIQUE,   -- {oid}/{uuid}__{name}[.gz]
    original_name  NVARCHAR(256) NOT NULL,
    content_type   NVARCHAR(128) NULL,              -- ORIGINAL type (restored on view/download)
    size_bytes     BIGINT        NULL,              -- original size
    stored_bytes   BIGINT        NULL,              -- size in Blob (after gzip, if any)
    is_compressed  BIT           NOT NULL DEFAULT 0,
    uploaded_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_raul_tax_files_user FOREIGN KEY (owner_oid)
        REFERENCES raul_tax_users(entra_object_id)
);

CREATE INDEX ix_raul_tax_files_owner ON raul_tax_files(owner_oid);
