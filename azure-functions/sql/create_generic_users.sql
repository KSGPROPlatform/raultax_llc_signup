-- Generic user-mirror table for an app onboarding to the shared ksgpro-api.
-- Replace <app>_users with the name you register in APP_REGISTRY.usersTable.
-- App-specific fields go in the `profile` JSON blob (served by upsertAppUser).
CREATE TABLE <app>_users (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    entra_object_id  NVARCHAR(64)  NOT NULL UNIQUE,
    email            NVARCHAR(256) NULL,
    name             NVARCHAR(256) NULL,
    role             NVARCHAR(20)  NOT NULL DEFAULT 'user',
    profile          NVARCHAR(MAX) NULL,        -- app-specific JSON
    created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT chk_<app>_users_role CHECK (role IN ('user', 'admin'))
    -- optional: , CONSTRAINT chk_<app>_users_profile_json CHECK (profile IS NULL OR ISJSON(profile) = 1)
);
