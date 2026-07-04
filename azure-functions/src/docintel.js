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

// Validate an actual US Social Security card — not just "an image with numbers".
// A real card always OCRs the phrase "SOCIAL SECURITY" and shows the 9-digit
// number; genuine cards also carry SSA-specific wording (administration, the
// "social security number" label, a signature line, the reverse-side privacy
// notice). We REQUIRE the number AND the "social security" header, and score the
// extra signals so the decision is transparent (and tunable).
function validateSsnCard(text) {
  const t = text || "";
  const ssn = extractSsn(t);
  const signals = {
    has_ssn_number: Boolean(ssn),
    has_social_security_text: /social\s*security/i.test(t),
    has_administration: /administration/i.test(t),
    has_number_label: /social\s*security\s*(number|no\.?|account|acct)/i.test(t),
    has_signature: /signature/i.test(t),
    has_privacy_notice: /privacy\s*act|see\s*instructions|reverse/i.test(t),
  };
  const strong = [
    signals.has_administration,
    signals.has_number_label,
    signals.has_signature,
    signals.has_privacy_notice,
  ].filter(Boolean).length;
  // Must have the number AND the "SOCIAL SECURITY" wording. A random photo of
  // digits has the number but never the wording, so it's rejected.
  const ok = signals.has_ssn_number && signals.has_social_security_text;
  return { ok, ssn, signals, strong };
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

// Extra per-form validation on top of the model's confidence. `titleRe` must be
// found in the OCR text (or the model's own docType) so we're sure the upload is
// really that form — e.g. a real W-2 always OCRs "W-2" / "Wage and Tax Statement".
const W2_RULE = {
  label: "W-2",
  titleRe: /\bW-?2\b|wage\s+and\s+tax\s+statement/i,
  docTypeRe: /w-?2/i,
};
const RULE_1099 = {
  label: "1099",
  titleRe: /\b1099\b/i,
  docTypeRe: /1099/i,
};

// Gate a structured (prebuilt-tax / id) result. Requires a confident document
// WITH fields, and — when a rule is given — the form's own title wording.
function structuredGate(doc, text, rule) {
  if (!doc) return { ok: false, signals: {} };
  const conf = doc.confidence != null ? doc.confidence : 0;
  const hasFields = doc.fields && Object.keys(doc.fields).length > 0;
  const confOk = conf >= MIN_CONFIDENCE;
  let titleOk = true;
  if (rule && rule.titleRe) {
    titleOk =
      rule.titleRe.test(text) ||
      (rule.docTypeRe && rule.docTypeRe.test(String(doc.docType || "")));
  }
  return {
    ok: confOk && Boolean(hasFields) && titleOk,
    signals: { confidence: conf, has_fields: Boolean(hasFields), title_matched: titleOk },
  };
}

async function analyzeStructured(model, bytes, extra, rule) {
  const r = await analyze(model, bytes);
  const doc = (r.documents && r.documents[0]) || null;
  const gate = structuredGate(doc, r.content || "", rule); // Stage 1
  if (!gate.ok) return { status: "mismatch", model };
  const { flat, rich } = normalize(doc.fields); // Stage 2
  return {
    status: "done",
    model,
    flat: { ...flat, ...(extra || {}), ...(rule ? { __validated: gate.signals } : {}) },
    rich,
  };
}

// A 1099 could be any variant — OCR to find which, then run that model. No
// variant found in the text -> it isn't a 1099 -> mismatch. The variant model is
// then held to the 1099 title rule too.
async function analyze1099(bytes) {
  const read = await analyze("prebuilt-read", bytes);
  const text = read.content || "";
  const variantModel = detect1099Variant(text);
  if (!variantModel) return { status: "mismatch", model: "prebuilt-read" };
  return analyzeStructured(
    variantModel,
    bytes,
    { variant: variantModel.replace("prebuilt-tax.us.1099", "") },
    RULE_1099,
  );
}

// Main entry: run the right model for a doc_type. Returns { status, model?, flat?, rich? }.
// status 'unsupported' means we don't extract that doc type (no DI call made).
async function analyzeForDocType(docType, bytes) {
  const model = MODEL_FOR[docType];
  if (!model) return { status: "unsupported" };
  if (model === "__1099__") return analyze1099(bytes);

  if (model === "prebuilt-read") {
    // SSN card: must look like an actual Social Security card (number + the
    // "SOCIAL SECURITY" wording), not merely an image containing digits.
    const r = await analyze("prebuilt-read", bytes);
    const content = r.content || "";
    const v = validateSsnCard(content);
    if (!v.ok) return { status: "mismatch", model: "prebuilt-read" };
    return {
      status: "done",
      model: "prebuilt-read",
      flat: { ssn: v.ssn, is_social_security_card: true, ...v.signals },
      rich: { ssn: { value: v.ssn, confidence: null } },
    };
  }

  // Structured models. W-2 gets its title rule; ID relies on the model's own
  // (already strong) document recognition.
  const rule = docType === "w2" ? W2_RULE : null;
  return analyzeStructured(model, bytes, {}, rule);
}

module.exports = { analyzeForDocType, MODEL_FOR };
