// Pure Form-1040 computation engine (v1) — implements docs/1040-mapping.md
// exactly. No I/O: input is a data snapshot + a verified year rules object;
// output is every computed line for the 1040 / Schedule 1 / Schedule SE, plus
// preparer flags. All money is rounded to whole dollars per line (IRS rule).
//
// snapshot = {
//   taxYear, filingStatus,                    // exact app strings
//   birthDateSelf, birthDateSpouse,           // "MM/DD/YYYY" or null
//   w2s:      [{ box1, box2, box3, box7, box10, box12T, employer }],
//   f1099s:   [{ withheld, payer }],
//   companies:[{ net, name }],
//   dependents:[{ dob, hasSsn }],
//   estimatedPayments,                        // number or null (line 26)
// }

const { getRules } = require("./taxRules");

const r = (n) => Math.round(n); // whole dollars, half rounds up
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);

const STATUS_KEY = {
  "Single": "single",
  "Married filing jointly": "mfj",
  "Married filing separately": "mfs",
  "Head of household": "hoh",
};

function parseDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Age 65+ box (12d) / senior deduction: born before Jan 2 of (taxYear − 64).
function bornBeforeSeniorCutoff(dobStr, taxYear) {
  const dob = parseDate(dobStr);
  return dob !== null && dob < new Date(taxYear - 64, 0, 2);
}

// Qualifying child for the CTC: under 17 at the END of the tax year.
function isQualifyingChildAge(dobStr, taxYear) {
  const dob = parseDate(dobStr);
  if (!dob) return false;
  const seventeenth = new Date(dob.getFullYear() + 17, dob.getMonth(), dob.getDate());
  return seventeenth > new Date(taxYear, 11, 31);
}

// Progressive rate-schedule tax (v1 uses the rate schedule; the IRS Tax Table
// for incomes under $100k may differ by a few dollars — preparer reviews).
function bracketTax(taxable, brackets) {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxable <= lower) break;
    const slice = Math.min(taxable, b.upTo) - lower;
    tax += slice * b.rate;
    lower = b.upTo;
  }
  return r(tax);
}

// Company-name normalizer for the W-2/1099 same-firm 8919 heuristic.
const firmKey = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function computeAll(snapshot) {
  const flags = [];
  const taxYear = Number(snapshot.taxYear);
  const rules = getRules(taxYear);
  if (!rules) {
    return {
      supported: false,
      flags: [`No verified rules file for tax year ${taxYear} — cannot compute.`],
    };
  }

  const status = STATUS_KEY[snapshot.filingStatus] ?? null;
  if (!status) {
    flags.push(
      `Filing status "${snapshot.filingStatus || "(none)"}" missing/unknown — computed as Single; preparer must fix.`,
    );
  }
  const st = status ?? "single";
  const w2s = snapshot.w2s || [];
  const f1099s = snapshot.f1099s || [];
  const companies = snapshot.companies || [];
  const dependents = snapshot.dependents || [];

  // ---------- Document-driven sub-form triggers (flag-only modules) ----------
  for (const [i, w] of w2s.entries()) {
    if (!Number.isFinite(Number(w.box1))) flags.push(`W-2 #${i + 1} (${w.employer || "?"}): box 1 missing/unreadable — line 1a incomplete.`);
    if (!Number.isFinite(Number(w.box2))) flags.push(`W-2 #${i + 1} (${w.employer || "?"}): box 2 missing/unreadable — line 25a incomplete.`);
    if (num(w.box10) > 0) flags.push(`W-2 #${i + 1}: box 10 dependent-care benefits ($${num(w.box10)}) — Form 2441 required (line 1e).`);
    if (num(w.box12T) > 0) flags.push(`W-2 #${i + 1}: box 12 code T adoption benefits — Form 8839 required (line 1f).`);
    if (num(w.box7) > 0) flags.push(`W-2 #${i + 1}: box 7 tips ($${num(w.box7)}) — possible Schedule 1-A tips deduction (qualified occupation check).`);
  }
  const w2Firms = new Set(w2s.map((w) => firmKey(w.employer)).filter(Boolean));
  for (const n of f1099s) {
    if (firmKey(n.payer) && w2Firms.has(firmKey(n.payer))) {
      flags.push(`Same firm on a W-2 and a 1099 (${n.payer}) — possible Form 8919 case (line 1g), reason code H.`);
    }
  }

  // ------------------------------ Line 1 ------------------------------------
  const f1040 = {};
  f1040.line_1a = r(sum(w2s, (w) => w.box1)); // Σ box 1, year-scoped, verified docs
  // 1b–1i parked (NULL). 1z sums 1a–1h with NULLs as 0:
  f1040.line_1z = f1040.line_1a;

  // --------------------------- Schedule SE (early: feeds AGI) ---------------
  const se = {};
  const businessNet = r(sum(companies, (c) => c.net));
  se.se_2 = businessNet;
  se.se_3 = se.se_2; // farm lines parked -> 0
  se.se_4a = se.se_3 > 0 ? r(se.se_3 * rules.se.netEarningsFactor) : se.se_3;
  se.se_4c = se.se_4a; // optional methods parked
  const seApplies = se.se_4c >= rules.se.minimumNetEarnings;
  if (seApplies) {
    se.se_6 = se.se_4c; // church income parked
    se.se_8a = r(sum(w2s, (w) => num(w.box3) + num(w.box7)));
    se.se_8d = se.se_8a; // 4137 / 8919 parked
    se.se_9 = Math.max(0, rules.se.ssWageCap - se.se_8d);
    se.se_10 = r(Math.min(se.se_6, se.se_9) * rules.se.ssRate);
    se.se_11 = r(se.se_6 * rules.se.medicareRate);
    se.se_12 = se.se_10 + se.se_11;
    se.se_13 = r(se.se_12 * rules.se.deductionFactor);
  } else {
    se.se_6 = 0; se.se_8a = 0; se.se_8d = 0; se.se_9 = 0;
    se.se_10 = 0; se.se_11 = 0; se.se_12 = 0; se.se_13 = 0;
  }

  // ------------------------------ Schedule 1 --------------------------------
  const s1 = {};
  s1.s1_3 = businessNet;             // Σ company P&L nets (Schedule C v1)
  s1.s1_9 = 0;                       // 8a–8z parked
  s1.s1_10 = s1.s1_3 + s1.s1_9;      // lines 1,2a,4–7 parked -> 0
  s1.s1_15 = se.se_13;               // ½ SE tax deduction
  s1.s1_25 = 0;                      // 24a–24z parked
  s1.s1_26 = s1.s1_15 + s1.s1_25;    // 11–23 parked -> 0

  // --------------------------- Income totals / AGI --------------------------
  f1040.line_8 = s1.s1_10;
  f1040.line_9 = f1040.line_1z + f1040.line_8; // 2b,3b,4b,5b,6b,7a NULL -> 0
  f1040.line_10 = s1.s1_26;
  f1040.line_11a = f1040.line_9 - f1040.line_10;
  f1040.line_11b = f1040.line_11a;

  // --------------------------- Deductions (12e, 13a, 13b) -------------------
  const selfSenior = bornBeforeSeniorCutoff(snapshot.birthDateSelf, taxYear);
  const spouseCounts = st === "mfj"; // spouse boxes apply on a joint return
  const spouseSenior = spouseCounts && bornBeforeSeniorCutoff(snapshot.birthDateSpouse, taxYear);
  const ageBoxes = (selfSenior ? 1 : 0) + (spouseSenior ? 1 : 0); // blindness = preparer override
  f1040.line_12e =
    rules.standardDeduction[st] + ageBoxes * rules.additionalStdDeduction[st];

  // Schedule 1-A v1 = Part V (senior deduction) only; tips flagged above.
  const magi = f1040.line_11b;
  const seniorPhaseStart = rules.seniorDeduction.phaseOutStart[st];
  const seniorAmt = Math.max(
    0,
    rules.seniorDeduction.perPerson -
      r(rules.seniorDeduction.phaseOutRate * Math.max(0, magi - seniorPhaseStart)),
  );
  // Married taxpayers must file JOINTLY to claim it (form caution).
  const seniorEligibleSelf = selfSenior && st !== "mfs";
  f1040.line_13b = (seniorEligibleSelf ? seniorAmt : 0) + (spouseSenior ? seniorAmt : 0);

  // Form 8995 QBI (needs taxable income BEFORE the QBI deduction).
  const taxableBeforeQbi = Math.max(0, f1040.line_11b - f1040.line_12e - f1040.line_13b);
  let qbiDeduction = 0;
  if (businessNet > 0) {
    if (taxableBeforeQbi > rules.qbi.taxableIncomeLimit[st]) {
      flags.push(
        `Taxable income before QBI ($${taxableBeforeQbi}) exceeds the Form 8995 limit — 8995-A applies; QBI deduction left to preparer (line 13a).`,
      );
    } else {
      const component = r(rules.qbi.rate * businessNet); // v1: QBI = Schedule C net
      const incomeLimit = r(rules.qbi.rate * taxableBeforeQbi); // v1: no capital gains
      qbiDeduction = Math.min(component, incomeLimit);
    }
  } else if (businessNet < 0) {
    flags.push(`Business net is a loss ($${businessNet}) — QBI loss carryforward to next year (preparer note).`);
  }
  f1040.line_13a = qbiDeduction;

  f1040.line_14 = f1040.line_12e + f1040.line_13a + f1040.line_13b;
  f1040.line_15 = Math.max(0, f1040.line_11b - f1040.line_14);

  // ------------------------------- Tax (16–18) ------------------------------
  f1040.line_16 = bracketTax(f1040.line_15, rules.brackets[st]);
  f1040.line_17 = 0; // Schedule 2 Part I parked
  f1040.line_18 = f1040.line_16 + f1040.line_17;

  // --------------------------- Schedule 8812 (19, 28) -----------------------
  const qc = dependents.filter((d) => isQualifyingChildAge(d.dob, taxYear) && d.hasSsn);
  const others = dependents.length - qc.length;
  const noSsnMinors = dependents.filter((d) => isQualifyingChildAge(d.dob, taxYear) && !d.hasSsn).length;
  if (noSsnMinors > 0) {
    flags.push(`${noSsnMinors} dependent(s) under 17 without an SSN — counted for the $500 credit, not the child tax credit (verify).`);
  }
  let line19 = 0;
  let line28 = 0;
  if (dependents.length > 0) {
    const l5 = qc.length * rules.ctc.perQualifyingChild;
    const l7 = others * rules.ctc.perOtherDependent;
    const l8 = l5 + l7;
    const excess = Math.max(0, f1040.line_11a - rules.ctc.phaseOutThreshold[st]);
    const l10 = Math.ceil(excess / 1000) * 1000;
    const l11 = r(l10 * rules.ctc.phaseOutRate);
    const l12 = l8 > l11 ? l8 - l11 : 0;
    const l13 = f1040.line_18; // v1 Credit Limit Worksheet A ≈ line 18 (no other credits)
    line19 = Math.min(l12, l13);
    // Additional CTC (refundable), Part II-A:
    if (l12 > line19 && qc.length > 0) {
      const l16a = l12 - line19;
      const l16b = qc.length * rules.ctc.actcPerChild;
      const l17 = Math.min(l16a, l16b);
      const earned = Math.max(0, f1040.line_1z + s1.s1_3 - s1.s1_15);
      const l19x = Math.max(0, earned - rules.ctc.actcEarnedIncomeFloor);
      const l20 = r(l19x * rules.ctc.actcRate);
      if (l16b >= rules.ctc.actcPartIIBThreshold && l20 < l17) {
        flags.push("Additional CTC Part II-B applies (3+ qualifying children) — preparer must complete lines 21–27; conservative amount used.");
        line28 = Math.min(l17, l20);
      } else {
        line28 = Math.min(l17, l20);
      }
    }
    // Residency/support confirmations are preparer's (form caution).
  }
  f1040.line_19 = line19;
  f1040.line_20 = 0; // Schedule 3 Part I parked (2441/8839 flag when triggered)
  f1040.line_21 = f1040.line_19 + f1040.line_20;
  f1040.line_22 = Math.max(0, f1040.line_18 - f1040.line_21);
  f1040.line_23 = se.se_12; // Schedule 2 line 21 v1 = SE tax
  f1040.line_24 = f1040.line_22 + f1040.line_23;

  // --------------------------- Payments (25–33) -----------------------------
  f1040.line_25a = r(sum(w2s, (w) => w.box2));
  f1040.line_25b = r(sum(f1099s, (n) => n.withheld));
  f1040.line_25d = f1040.line_25a + f1040.line_25b; // 25c parked
  f1040.line_26 = num(snapshot.estimatedPayments);
  f1040.line_27a = 0; // EIC: flag-only in v1
  if (f1040.line_11a < rules.eicFlagAgiCeiling && (qc.length > 0 || f1040.line_11a < 20000)) {
    flags.push("Possible EIC eligibility (heuristic) — preparer review (line 27a).");
  }
  f1040.line_28 = line28;
  f1040.line_32 = f1040.line_27a + f1040.line_28; // 29,30,31 parked -> 0
  f1040.line_33 = f1040.line_25d + f1040.line_26 + f1040.line_32;

  // --------------------------- Refund / owed (34–37) ------------------------
  f1040.line_34 = Math.max(0, f1040.line_33 - f1040.line_24);
  f1040.line_35a = f1040.line_34; // line 36 split parked
  f1040.line_37 = Math.max(0, f1040.line_24 - f1040.line_33);

  return {
    supported: true,
    method: "rate-schedule", // v1 note: IRS Tax Table (<$100k) may differ by a few dollars
    f1040,
    s1,
    se: seApplies ? se : { se_2: se.se_2, se_3: se.se_3, se_4a: se.se_4a, se_4c: se.se_4c, se_12: 0, se_13: 0 },
    flags,
  };
}

module.exports = { computeAll, bracketTax, isQualifyingChildAge, bornBeforeSeniorCutoff };
