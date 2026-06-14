const sql = require("mssql");

// Prefer a single SQL_CONNECTION_STRING (what some Function Apps already have
// set); otherwise build the config from discrete SQL_* settings. Either way the
// values come from the Function App's settings (or local.settings.json locally).
const connStr = process.env.SQL_CONNECTION_STRING;

const config = connStr || {
  server: process.env.SQL_SERVER, // e.g. myserver.database.windows.net
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true, // required for Azure SQL
    trustServerCertificate: false,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    if (!connStr) {
      for (const key of ["server", "database", "user", "password"]) {
        if (!config[key]) {
          throw new Error(
            `Missing SQL_${key.toUpperCase()} (or set SQL_CONNECTION_STRING)`,
          );
        }
      }
    }
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

module.exports = { sql, getPool };
