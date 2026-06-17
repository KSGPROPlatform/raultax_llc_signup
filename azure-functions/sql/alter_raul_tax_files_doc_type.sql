-- Form 5 (Documents): tag each stored file with its category (e.g. 'w2',
-- 'id_front', '1099'…) or NULL for an uncategorised / legacy upload.
-- Run once against the raultax database.
ALTER TABLE dbo.raul_tax_files ADD doc_type NVARCHAR(64) NULL;
