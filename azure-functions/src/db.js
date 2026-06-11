const sql = require("mssql");

// One shared connection pool for all functions. Values come from the Function
// App's Application settings (or local.settings.json when running locally).
const config = {
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
    for (const key of ["server", "database", "user", "password"]) {
      if (!config[key]) {
        throw new Error(`Missing SQL_${key.toUpperCase()} app setting`);
      }
    }
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

module.exports = { sql, getPool };
