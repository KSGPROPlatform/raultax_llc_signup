// Azure Document Intelligence (Form Recognizer) client + normalizers.
// Uses the v4 GA REST API (2024-11-30): POST :analyze -> poll operation-location.
// Endpoint + key come from the DOCINTEL_ENDPOINT / DOCINTEL_KEY app settings.

const API_VERSION = "2024-11-30";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Which prebuilt model each uploaded doc_type maps to. "__1099__" is special:
// we OCR first to detect the variant, then run the matching 1099 model.
const MODEL_FOR = {
  w2: "prebuilt-tax.us.w2",
  id_front: "prebuilt-idDocument",
  id_back: "prebuilt-idDocument",
  ssn_copy: "prebuilt-read",
  spouse_ssn_copy: "prebuilt-read",
  form_1099: "__1099__",
};

function endpointAndKey() {
  const endpoint = (process.env.DOCINTEL_ENDPOINT || "").replace(/\/$/, "");
  const key = process.env.DOCINTEL_KEY || "";
  if (!endpoint || !key) throw new Error("Document Intelligence is not configured");
  return { endpoint, key };
}

// Run one prebuilt model over the given bytes; returns analyzeResult.
async function analyze(model, bytes) {
  const { endpoint, key } = endpointAndKey();
  const url = `${endpoint}/documentintelligence/documentModels/${model}:analyze?api-version=${API_VERSION}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Source: bytes.toString("base64") }),
  });
  if (res.status !== 202) {
    const t = await res.text().catch(() => "");
    throw new Error(`analyze ${model} failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const opLoc = res.headers.get("operation-location");
  if (!opLoc) throw new Error("analyze: missing operation-location");

  const deadline = Date.now() + 55000;
  while (Date.now() < deadline) {
    await sleep(1500);
    const pr = await fetch(opLoc, { headers: { "Ocp-Apim-Subscription-Key": key } });
    const pj = await pr.json().catch(() => ({}));
    if (pj.status === "succeeded") return pj.analyzeResult || {};
    if (pj.status === "failed") {
      throw new Error("analyze failed: " + JSON.stringify(pj.error || {}).slice(0, 200));
    }
  }
  throw new Error("analyze timed out");
}

// Pull a plain JS value out of a DI field object (handles the v4 value* shapes,
// including nested objects/arrays like the W-2 employee/employer groups).
function fieldValue(f) {
  if (!f || typeof f !== "object") return null;
  if (f.valueString != null) return f.valueString;
  if (f.valueNumber != null) return f.valueNumber;
  if (f.valueInteger != null) return f.valueInteger;
  if (f.valueDate != null) return f.valueDate;
  if (f.valueTime != null) return f.valueTime;
  if (f.valuePhoneNumber != null) return f.valuePhoneNumber;
  if (f.valueCountryRegion != null) return f.valueCountryRegion;
  if (f.valueSelectionMark != null) return f.valueSelectionMark;
  if (f.valueCurrency != null) return f.valueCurrency.amount ?? f.content ?? null;
  if (f.valueAddress != null) return f.content ?? null;
  if (Array.isArray(f.valueArray)) return f.valueArray.map(fieldValue);
  if (f.valueObject != null) {
    const o = {};
    for (const [k, v] of Object.entries(f.valueObject)) o[k] = fieldValue(v);
    return o;
  }
  return f.content ?? null;
}

// documents[0].fields -> { flat: {k:value}, rich: {k:{value,confidence}} }
function normalize(fields) {
  const flat = {};
  const rich = {};
  for (const [k, f] of Object.entries(fields || {})) {
    flat[k] = fieldValue(f);
    rich[k] = { value: flat[k], confidence: f && f.confidence != null ? f.confidence : null };
  }
  return { flat, rich };
}

// First SSN-looking token in OCR text.
function extractSsn(text) {
  const m = (text || "").match(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/);
  return m ? m[0].replace(/[-\s]/g, "").replace(/(\d{3})(\d{2})(\d{4})/, "$1-$2-$3") : "";
}

const VARIANT_MODELS = ["NEC", "MISC", "DIV", "INT", "R", "G", "K"];
function detect1099Variant(text) {
  const t = (text || "").toUpperCase().replace(/[\s.]+/g, "");
  for (const v of VARIANT_MODELS) {
    if (t.includes(`1099-${v}`) || t.includes(`1099${v}`) || t.includes(`FORM1099${v}`)) {
      return `prebuilt-tax.us.1099${v}`;
    }
  }
  return null;
}

// Stage 1 gate: a real document of the expected type comes back as a confident
// document WITH fields. A wrong file (random PDF, unrelated form) comes back with
// no documents / very low confidence -> we reject it as a mismatch.
const MIN_CONFIDENCE = 0.5;
function isRightDocument(doc) {
  if (!doc) return false;
  const conf = doc.confidence != null ? doc.confidence : 0;
  const hasFields = doc.fields && Object.keys(doc.fields).length > 0;
  return conf >= MIN_CONFIDENCE && hasFields;
}

async function analyzeStructured(model, bytes, extra) {
  const r = await analyze(model, bytes);
  const doc = (r.documents && r.documents[0]) || null;
  if (!isRightDocument(doc)) return { status: "mismatch", model }; // Stage 1 fail
  const { flat, rich } = normalize(doc.fields); // Stage 2
  return { status: "done", model, flat: { ...flat, ...(extra || {}) }, rich };
}

// A 1099 could be any variant — OCR to find which, then run that model. No
// variant found in the text -> it isn't a 1099 -> mismatch.
async function analyze1099(bytes) {
  const read = await analyze("prebuilt-read", bytes);
  const text = read.content || "";
  const variantModel = detect1099Variant(text);
  if (!variantModel) return { status: "mismatch", model: "prebuilt-read" };
  return analyzeStructured(variantModel, bytes, {
    variant: variantModel.replace("prebuilt-tax.us.1099", ""),
  });
}

// Main entry: run the right model for a doc_type. Returns { status, model?, flat?, rich? }.
// status 'unsupported' means we don't extract that doc type (no DI call made).
async function analyzeForDocType(docType, bytes) {
  const model = MODEL_FOR[docType];
  if (!model) return { status: "unsupported" };
  if (model === "__1099__") return analyze1099(bytes);

  if (model === "prebuilt-read") {
    // SSN card: must actually contain an SSN pattern, else it's the wrong doc.
    const r = await analyze("prebuilt-read", bytes);
    const content = r.content || "";
    const ssn = extractSsn(content);
    if (!ssn) return { status: "mismatch", model: "prebuilt-read" };
    return {
      status: "done",
      model: "prebuilt-read",
      flat: { ssn, text: content.slice(0, 2000) },
      rich: { ssn: { value: ssn, confidence: null } },
    };
  }

  return analyzeStructured(model, bytes);
}

module.exports = { analyzeForDocType, MODEL_FOR };
