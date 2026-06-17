# ksgpro-api — shared Azure Functions

A **multi-app** HTTP API: generic per-user **file storage** (Blob + SQL) and a
generic **user mirror**, plus raultax's tax-specific user upsert. One Function
App serves many apps; each app's SQL tables + Blob container are resolved
**server-side** from a registry — callers send an opaque `X-App-Id` header and
**never** raw table/container names.

Called **server-to-server** with a function key — never from the browser.

| Function | Method / route | Header | Purpose |
|----------|----------------|--------|---------|
| `uploadFile`   | `POST /api/uploadFile?oid=&filename=&contentType=` (raw body) | `X-App-Id` | Store a file in the app's container; gzip if > `COMPRESS_THRESHOLD_BYTES` (5 MB); record a row in the app's files table. |
| `listFiles`    | `GET /api/listFiles?oid=` | `X-App-Id` | The user's files, newest first. |
| `viewFile`     | `GET /api/viewFile?id=&oid=` | `X-App-Id` | Owner-checked; returns the original (decompressed) bytes + content type. |
| `deleteFile`   | `DELETE /api/deleteFile?id=&oid=` | `X-App-Id` | Owner-checked; deletes blob + row. |
| `upsertAppUser`| `POST /api/upsertAppUser` (`{oid,email?,name?,profile?}`) | `X-App-Id` | **Generic** Entra→SQL user mirror; app data in a `profile` JSON column. |
| `upsertUser`   | `POST /api/upsertUser` | — | **raultax-specific** user upsert (typed tax columns). |

## The app registry
`APP_REGISTRY` (app setting, JSON) maps each app to its tables + container:
```json
{"raultax":{"usersTable":"raul_tax_users","filesTable":"raul_tax_files","container":"democontainer"}}
```
A request with an unknown / missing `X-App-Id` → **400**. (Missing header
currently defaults to `raultax` for backward-compat — see `src/functions/*`.)

## App settings
On the Function App (**Settings → Environment variables**) or `local.settings.json`:
- `SQL_CONNECTION_STRING` (or discrete `SQL_SERVER`/`SQL_DATABASE`/`SQL_USER`/`SQL_PASSWORD`)
- `STORAGE_CONNECTION` (Blob), `STORAGE_CONTAINER` (legacy default only)
- `COMPRESS_THRESHOLD_BYTES` (optional, default 5 MB)
- `APP_REGISTRY` (JSON above)

SQL server → **Networking** → allow Azure services. Storage account → public
access enabled (or allow the Function App).

## Run / deploy
```bash
cd azure-functions
npm install
npm start                                  # local: http://localhost:7071/api/...
func azure functionapp publish ksgpro-api  # deploy
```

## Wire a calling app (server-side only)
- `PROFILE_API_URL` – `https://<function-app>.<region>-NN.azurewebsites.net/api`
- `PROFILE_API_KEY` – a function key (Function App → App keys)
- Send `X-App-Id: <yourAppId>` on every call (see `lib/files.ts`).
- Resilience: if the function/DB is down, the calling app should degrade
  gracefully (raultax falls back to role `user`, empty file list).

## Onboard a new app
1. Create `<app>_users` + `<app>_files` from
   [`sql/create_generic_users.sql`](sql/create_generic_users.sql) and
   [`sql/create_generic_files.sql`](sql/create_generic_files.sql); pick a Blob container.
2. Add the app to `APP_REGISTRY`; restart the Function App.
3. From the new app's server, call the functions with `X-App-Id: <app>` and the
   function key; use `upsertAppUser` for users (app data in `profile` JSON).

## Security
The function key is the auth boundary. `X-App-Id` only *selects* a dataset the
key is already authorized for; table/container names come only from the registry
(validated), never from the caller. **Future hardening:** issue a per-app
function key and derive `X-App-Id` from the key server-side.
