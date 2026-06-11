import "server-only";
import sql from "mssql";

// Direct connection to Azure SQL from the app (no Azure Functions for now).
// Values come from .env.local. If they're not set yet, isDbConfigured() is
// false and the data layer falls back to mock data so the UI still renders.
const config: sql.config = {
  server: process.env.SQL_SERVER ?? "",
  database: process.env.SQL_DATABASE ?? "",
  user: process.env.SQL_USER ?? "",
  password: process.env.SQL_PASSWORD ?? "",
  options: { encrypt: true, trustServerCertificate: false },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.SQL_SERVER &&
      process.env.SQL_DATABASE &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD,
  );
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

export { sql };
