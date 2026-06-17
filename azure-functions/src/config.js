// Per-app registry for the shared ksgpro-api. Callers send an opaque appId
// (the `X-App-Id` header); we map it HERE to concrete table/container names.
// Names NEVER come from the caller, so app A cannot address app B's data.
//
// APP_REGISTRY app setting is JSON, e.g.:
// {"raultax":{"usersTable":"raul_tax_users","filesTable":"raul_tax_files","container":"democontainer"}}

// SQL identifiers can't be bind parameters, so table names are string-
// interpolated. Even though they come from the trusted registry (not callers),
// validate them as defense-in-depth against a bad APP_REGISTRY value.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const CONTAINER = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/; // Azure container rules

let cache;
function registry() {
  if (!cache) {
    const raw = process.env.APP_REGISTRY;
    if (!raw) throw new Error("Missing APP_REGISTRY app setting");
    try {
      cache = JSON.parse(raw);
    } catch {
      throw new Error("APP_REGISTRY is not valid JSON");
    }
  }
  return cache;
}

// Returns { usersTable, filesTable, container } for the app, or throws.
// A bad/unknown appId throws an error tagged statusCode 400 so handlers can
// distinguish "client sent a bad app" from "server is misconfigured".
function getAppConfig(appId) {
  if (!appId || typeof appId !== "string") {
    const e = new Error("Missing X-App-Id header");
    e.statusCode = 400;
    throw e;
  }
  const cfg = registry()[appId];
  if (!cfg) {
    const e = new Error(`Unknown app: ${appId}`);
    e.statusCode = 400;
    throw e;
  }
  const { usersTable, filesTable, container } = cfg;
  if (usersTable && !IDENT.test(usersTable)) {
    throw new Error(`Invalid usersTable for app ${appId}`);
  }
  if (filesTable && !IDENT.test(filesTable)) {
    throw new Error(`Invalid filesTable for app ${appId}`);
  }
  if (container && !CONTAINER.test(container)) {
    throw new Error(`Invalid container for app ${appId}`);
  }
  return { usersTable, filesTable, container };
}

module.exports = { getAppConfig };
