# raultax Azure Functions

Three HTTP functions backing the Next.js app's Azure SQL profile store
(`raul_tax_users`). Microsoft owns identity; these just mirror the profile.

| Function | Method / route | Purpose |
|----------|----------------|---------|
| `createUser`  | `POST /api/createUser`  | Upsert a user on sign-in (defaults role `user`) |
| `getUser`     | `GET /api/getUser?oid=` | One user's profile (normal dashboard) |
| `getAllUsers` | `GET /api/getAllUsers`  | List all users (admin panel) |

## 1. Create the table

In the Azure portal → your SQL database → **Query editor**, run
[`sql/create_raul_tax_users.sql`](sql/create_raul_tax_users.sql).

## 2. App settings (the SQL connection)

Set these on the Function App (**Configuration → Application settings**), or in
`local.settings.json` for local dev:

- `SQL_SERVER`   – e.g. `myserver.database.windows.net`
- `SQL_DATABASE` – your database name
- `SQL_USER`     – SQL admin login
- `SQL_PASSWORD` – SQL admin password

Also: SQL server → **Networking** → allow your Function App (enable
"Allow Azure services…") so the functions can reach the database.

## 3. Run / deploy

```bash
cd azure-functions
npm install
npm start          # local: http://localhost:7071/api/createUser
```

Deploy with the **Azure Functions** VS Code extension (Deploy to Function App)
or `func azure functionapp publish <your-function-app-name>`.

## 4. Wire the app

After deploy, give the Next.js app these (in its `.env.local`):

- `FUNCTIONS_BASE_URL` – `https://<your-function-app>.azurewebsites.net/api`
- `FUNCTIONS_KEY`      – a function key (Function App → App keys / each function's keys)

The app calls `createUser` after sign-in and `getUser` / `getAllUsers` to render
the role-based dashboard.
