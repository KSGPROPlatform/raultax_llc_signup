# raultax Azure Functions

One HTTP function that mirrors Entra users into Azure SQL.

| Function | Method / route | Purpose |
|----------|----------------|---------|
| `upsertUser` | `POST /api/upsertUser` | Upsert a user (by Entra `oid`) on sign-up/sign-in. New users default role `user`; existing roles are preserved. Returns the saved row. |

Called **server-to-server** by the Next.js app's auth route handlers (with a
function key) — never directly from the browser.

## 1. Create the table
Azure portal → your SQL database → **Query editor** → run
[`sql/create_raul_tax_users.sql`](sql/create_raul_tax_users.sql).

## 2. App settings (SQL connection)
Set on the Function App (**Settings → Environment variables**), or in
`local.settings.json` for local dev:
- `SQL_SERVER` – e.g. `myserver.database.windows.net`
- `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`

SQL server → **Networking** → allow Azure services so the Function can connect.

## 3. Run / deploy
```bash
cd azure-functions
npm install
npm start          # local: http://localhost:7071/api/upsertUser
func azure functionapp publish <your-function-app-name>   # deploy
```

## 4. Wire the Next.js app
Give the app (`.env.local` and SWA env vars):
- `FUNCTIONS_BASE_URL` – `https://<your-function-app>.azurewebsites.net/api`
- `FUNCTIONS_KEY` – a function key (Function App → App keys)

The app calls `upsertUser` after every sign-up and sign-in. If the function or
DB is unavailable, auth still succeeds (the user just defaults to role `user`).
