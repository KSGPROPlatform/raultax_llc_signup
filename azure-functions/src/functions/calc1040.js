const { app } = require("@azure/functions");
const { sql, getPool } = require("../db");
const { computeAll } = require("../taxEngine");

// /api/calc1040 — compute a declaration's Form 1040 from its verified data and
// store every line (raul_tax_form_1040 / _schedule1 / _schedule_se).
//   GET   ?oid=&taxYear=  -> the stored 1040 row (+ flags/overrides), or null
//   POST  ?oid=&taxYear=  -> load snapshot -> taxEngine.computeAll -> upsert ->
//                            return { f1040, s1, se, flags }. Refuses when the
//                            row is FROZEN (preparer approved) — returns stored.
//   PATCH ?oid=&taxYear=  -> preparer review actions:
//                            { overrides: { line_x: value|null, ... }, by, frozen }
//                            null removes an override; frozen true/false toggles
//                            the freeze. Overrides never touch computed values.
// Overrides (JSON on the 1040 row) are returned as-is; applying them is the
// review UI's job so computed values stay pure.

const SAFE_COL = /^(line|s1|se)_[0-9a-z]+$/;

function parseJson(s, fallback) {
  if (s === null || s === undefined) return fallback;
  try {
    const v = JSON.parse(s);
    // JSON.parse(null) returns null WITHOUT throwing — treat as missing.
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

// Map a stored W-2 extraction's promoted/model fields to engine inputs.
function w2FromFields(f) {
  let box12T = 0;
  const ai = f.AdditionalInfo;
  if (Array.isArray(ai)) {
    for (const e of ai) {
      if (e && typeof e === "object" && String(e.LetterCode ?? e.Code ?? "").toUpperCase() === "T") {
        box12T += Number(e.Amount) || 0;
      }
    }
  }
  return {
    box1: f.WagesTipsAndOtherCompensation,
    box2: f.FederalIncomeTaxWithheld,
    box3: f.SocialSecurityWages,
    box7: f.SocialSecurityTips,
    box10: f.DependentCareBenefits,
    box12T,
    employer: f.employer_name || "",
  };
}

function n1099FromFields(f) {
  return {
    withheld: f.FederalIncomeTaxWithheld ?? f.FederalTaxWithheld ?? 0,
    payer: f.company_name || "",
  };
}

// Load everything the engine needs for (oid, taxYear) — all verified data.
async function loadSnapshot(pool, oid, taxYear) {
  const q = (text, extra = {}) => {
    const req = pool.request().input("oid", sql.NVarChar(64), oid).input("year", sql.Int, taxYear);
    for (const [k, v] of Object.entries(extra)) req.input(k, v);
    return req.query(text);
  };

  const decl = (await q(`
    SELECT filing_status, status FROM raul_tax_declarations
    WHERE owner_oid = @oid AND tax_year = @year;`)).recordset[0];
  if (!decl) return null;

  const user = (await q(`
    SELECT date_of_birth FROM raul_tax_users WHERE entra_object_id = @oid;`)).recordset[0];

  const spouse = (await q(`
    SELECT date_of_birth FROM raul_tax_spouse
    WHERE owner_oid = @oid AND tax_year = @year;`)).recordset[0];

  const dependents = (await q(`
    SELECT date_of_birth, ssn FROM raul_tax_dependents
    WHERE owner_oid = @oid AND tax_year = @year;`)).recordset;

  const companies = (await q(`
    SELECT company_name, business_expense FROM raul_tax_companies
    WHERE owner_oid = @oid AND tax_year = @year;`)).recordset;

  // JOIN the files table so orphaned extraction rows (file deleted outside the
  // app path) can never pollute the sums.
  const docs = (await q(`
    SELECT e.doc_type, e.fields_json
    FROM raul_tax_file_extractions e
    JOIN raul_tax_files f ON f.id = e.file_id
    WHERE e.owner_oid = @oid AND e.tax_year = @year AND e.status = 'done'
      AND e.doc_type IN ('w2', 'form_1099');`)).recordset;

  const w2s = [];
  const f1099s = [];
  for (const d of docs) {
    const f = parseJson(d.fields_json, {});
    if (d.doc_type === "w2") w2s.push(w2FromFields(f));
    else f1099s.push(n1099FromFields(f));
  }

  return {
    taxYear,
    filingStatus: decl.filing_status || "",
    declarationStatus: decl.status,
    birthDateSelf: user?.date_of_birth || null,
    birthDateSpouse: spouse?.date_of_birth || null,
    w2s,
    f1099s,
    companies: companies.map((c) => ({ net: Number(c.business_expense) || 0, name: c.company_name })),
    dependents: dependents.map((d) => ({ dob: d.date_of_birth, hasSsn: Boolean((d.ssn || "").trim()) })),
    estimatedPayments: null, // input field arrives later (ledger line 26)
  };
}

// Upsert one computed row; only whitelisted numeric columns are written.
async function upsertComputed(pool, table, oid, taxYear, values, flagsJson) {
  const cols = Object.entries(values).filter(
    ([k, v]) => SAFE_COL.test(k) && Number.isFinite(Number(v)),
  );
  const req = pool.request().input("oid", sql.NVarChar(64), oid).input("year", sql.Int, taxYear);
  cols.forEach(([k, v], i) => req.input(`p${i}`, sql.Decimal(18, 2), Number(v)));
  if (flagsJson !== undefined) req.input("flags", sql.NVarChar(sql.MAX), flagsJson);

  const setList = cols.map(([k], i) => `${k} = @p${i}`).join(", ");
  const insCols = cols.map(([k]) => k).join(", ");
  const insVals = cols.map((_, i) => `@p${i}`).join(", ");
  const flagsSet = flagsJson !== undefined ? "flags = @flags," : "";
  const flagsInsCol = flagsJson !== undefined ? "flags," : "";
  const flagsInsVal = flagsJson !== undefined ? "@flags," : "";

  await req.query(`
    MERGE ${table} AS t
    USING (SELECT @oid AS owner_oid, @year AS tax_year) AS s
      ON t.owner_oid = s.owner_oid AND t.tax_year = s.tax_year
    WHEN MATCHED THEN UPDATE SET ${setList}, ${flagsSet}
      computed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (owner_oid, tax_year, ${insCols}, ${flagsInsCol} computed_at)
      VALUES (@oid, @year, ${insVals}, ${flagsInsVal} SYSUTCDATETIME());
  `);
}

app.http("calc1040", {
  methods: ["GET", "POST", "PATCH"],
  authLevel: "function",
  route: "calc1040",
  handler: async (request, context) => {
    try {
      const oid = request.query.get("oid");
      const taxYear = Number(request.query.get("taxYear"));
      if (!oid || !Number.isInteger(taxYear)) {
        return { status: 400, jsonBody: { error: "oid and taxYear are required" } };
      }
      const pool = await getPool();

      if (request.method === "GET") {
        const row = (await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear)
          .query(`SELECT * FROM raul_tax_form_1040 WHERE owner_oid = @oid AND tax_year = @year;`))
          .recordset[0];
        if (!row) return { status: 200, jsonBody: null };
        row.flags = parseJson(row.flags, []);
        row.overrides = parseJson(row.overrides, {});
        return { status: 200, jsonBody: row };
      }

      if (request.method === "PATCH") {
        const b = (await request.json().catch(() => ({}))) || {};
        const row = (await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear)
          .query(`SELECT overrides FROM raul_tax_form_1040 WHERE owner_oid = @oid AND tax_year = @year;`))
          .recordset[0];
        if (!row) return { status: 404, jsonBody: { error: "No computed return for that year" } };

        const overrides = parseJson(row.overrides, {});
        if (b.overrides && typeof b.overrides === "object") {
          for (const [k, v] of Object.entries(b.overrides)) {
            if (!SAFE_COL.test(k)) continue;
            if (v === null) {
              delete overrides[k];
            } else {
              const value = Number(typeof v === "object" ? v.value : v);
              if (Number.isFinite(value)) {
                overrides[k] = {
                  value,
                  by: String(b.by || "admin").slice(0, 128),
                  at: new Date().toISOString(),
                };
              }
            }
          }
        }
        const frozenBit = typeof b.frozen === "boolean" ? (b.frozen ? 1 : 0) : null;
        await pool.request()
          .input("oid", sql.NVarChar(64), oid)
          .input("year", sql.Int, taxYear)
          .input("ov", sql.NVarChar(sql.MAX), JSON.stringify(overrides))
          .input("frozen", sql.Bit, frozenBit).query(`
            UPDATE raul_tax_form_1040
            SET overrides = @ov, frozen = COALESCE(@frozen, frozen),
                updated_at = SYSUTCDATETIME()
            WHERE owner_oid = @oid AND tax_year = @year;
          `);
        return { status: 200, jsonBody: { ok: true, overrides, frozen: frozenBit === null ? undefined : Boolean(frozenBit) } };
      }

      // POST — recompute (unless frozen).
      const existing = (await pool.request()
        .input("oid", sql.NVarChar(64), oid)
        .input("year", sql.Int, taxYear)
        .query(`SELECT frozen FROM raul_tax_form_1040 WHERE owner_oid = @oid AND tax_year = @year;`))
        .recordset[0];
      if (existing && existing.frozen) {
        return { status: 200, jsonBody: { computed: false, frozen: true } };
      }

      const snapshot = await loadSnapshot(pool, oid, taxYear);
      if (!snapshot) {
        return { status: 404, jsonBody: { error: "No declaration for that year" } };
      }

      const out = computeAll(snapshot);
      if (!out.supported) {
        return { status: 200, jsonBody: { computed: false, supported: false, flags: out.flags } };
      }

      const flagsJson = JSON.stringify(out.flags);
      await upsertComputed(pool, "raul_tax_form_1040", oid, taxYear, out.f1040, flagsJson);
      await upsertComputed(pool, "raul_tax_schedule1", oid, taxYear, out.s1);
      await upsertComputed(pool, "raul_tax_schedule_se", oid, taxYear, out.se);

      return {
        status: 200,
        jsonBody: { computed: true, frozen: false, f1040: out.f1040, s1: out.s1, se: out.se, flags: out.flags },
      };
    } catch (err) {
      context.error("calc1040 failed", err);
      return { status: 500, jsonBody: { error: "Internal error" } };
    }
  },
});
