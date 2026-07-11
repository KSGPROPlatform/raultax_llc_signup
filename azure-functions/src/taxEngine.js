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
//   dependents:[{ dob, hasSsn, careExpenses, isDisabled }],
//   careProviders: [{ name, amountPaid }],    // Form 2441 Part I rows
//   spouseEarnedIncome,                       // number or null (2441 lines 5/19)
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

// Form 2441 qualifying person by AGE: under 13 during (part of) the year —
// 13th birthday after Jan 1. Turning 13 mid-year still qualifies for the
// pre-birthday expenses (flagged for the preparer).
function isUnder13During(dobStr, taxYear) {
  const dob = parseDate(dobStr);
  if (!dob) return false;
  const thirteenth = new Date(dob.getFullYear() + 13, dob.getMonth(), dob.getDate());
  return thirteenth > new Date(taxYear, 0, 1);
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
  // BLANK-vs-ZERO rule (Doane 2026-07-11): a line is SET only when it applies
  // to this return — an unused line stays absent (NULL -> blank on the filled
  // form). 0 is written only when the computation really produced zero.
  const f1040 = {};
  const wages1a = r(sum(w2s, (w) => w.box1)); // Σ box 1, year-scoped, verified docs
  if (w2s.length > 0) f1040.line_1a = wages1a;
  // 1b–1i parked (NULL). 1e is set by Form 2441 Part III below; 1z after it.

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

  // --------------------- Form 2441 (ALWAYS COMPUTED when triggered) ---------
  // Doctrine: W-2 box 10 is only an INPUT — line 1e is only ever the COMPUTED
  // Part III line 26 (often $0 when benefits are fully excluded). The module
  // runs when box 10 exists OR the user reported childcare expenses.
  const f2441 = {};
  const box10Total = r(sum(w2s, (w) => w.box10));
  const qualifyingPersons = dependents.filter(
    (d) => isUnder13During(d.dob, taxYear) || Boolean(d.isDisabled),
  );
  const careExpensesTotal = r(sum(qualifyingPersons, (d) => d.careExpenses));
  const nonQualifyingCare = r(sum(dependents, (d) => d.careExpenses)) - careExpensesTotal;
  const ran2441 = box10Total > 0 || careExpensesTotal > 0;
  // Earned income, v1 definition (see ledger): W-2 box 1 wages + net SE
  // earnings − ½ SE tax; taxable benefits NOT added back (conservative).
  const earnedSelf = Math.max(0, wages1a + (seApplies ? se.se_6 - se.se_13 : 0));
  const spouseEarned = num(snapshot.spouseEarnedIncome);
  const expenseCap =
    qualifyingPersons.length >= 2 ? rules.f2441.expenseCapTwoPlus : rules.f2441.expenseCapOne;
  let s3_2 = 0; // Schedule 3 line 2 (the 2441 credit)
  if (ran2441) {
    if (nonQualifyingCare > 0) {
      flags.push(`Care expenses ($${nonQualifyingCare}) entered for dependents who aren't qualifying persons (13+ and not disabled) — excluded from Form 2441.`);
    }
    for (const d of qualifyingPersons) {
      const dob = parseDate(d.dob);
      if (dob && num(d.careExpenses) > 0) {
        const thirteenth = new Date(dob.getFullYear() + 13, dob.getMonth(), dob.getDate());
        if (thirteenth <= new Date(taxYear, 11, 31) && !d.isDisabled) {
          flags.push("A qualifying child turned 13 during the year — only pre-birthday care expenses qualify (Form 2441); verify the amount entered.");
        }
      }
    }
    if ((snapshot.careProviders || []).length === 0) {
      flags.push("Form 2441 Part I is mandatory — no care provider on file (name, address, tax ID, amount). Ask the client to add the provider.");
    }
    if (seApplies) {
      flags.push("Form 2441 earned income includes self-employment (net earnings − ½ SE tax) — preparer verify (v1 definition).");
    }
    if (st === "mfj" && snapshot.spouseEarnedIncome == null) {
      flags.push("Form 2441 needs the SPOUSE's earned income (lines 5/19) — missing, so the credit is $0 and benefits are fully taxable until entered.");
    }

    // ---- Part III (dependent care benefits) — only when box 10 exists ----
    if (box10Total > 0) {
      f2441.f2441_12 = box10Total;
      const l15 = box10Total; // 13/14 (grace-period carryover, forfeitures) v2 -> 0
      f2441.f2441_15 = l15;
      f2441.f2441_16 = careExpensesTotal;
      const l17 = Math.min(l15, careExpensesTotal);
      f2441.f2441_17 = l17;
      f2441.f2441_18 = earnedSelf;
      let l19;
      if (st === "mfj") l19 = spouseEarned;
      else if (st === "mfs") {
        l19 = 0; // v1 conservative: exclusion denied -> benefits fully taxable
        flags.push("Married filing separately with dependent-care benefits — v1 treats all benefits as taxable (line 1e); preparer applies the MFS exception if it holds.");
      } else l19 = earnedSelf;
      f2441.f2441_19 = l19;
      const l20 = Math.max(0, Math.min(l17, earnedSelf, l19));
      f2441.f2441_20 = l20;
      const l21 = st === "mfs" ? rules.f2441.exclusionLimitMfs : rules.f2441.exclusionLimit;
      f2441.f2441_21 = l21;
      const l22 = 0; // sole-proprietorship/partnership DCAP v2
      const l23 = l15 - l22;
      f2441.f2441_23 = l23;
      const l24 = Math.min(l20, l21, l22); // = 0 while l22 = 0
      f2441.f2441_24 = l24;
      const l25 = l22 === 0 ? Math.min(l20, l21) : Math.max(0, Math.min(l20, l21) - l24);
      f2441.f2441_25 = l25;
      f2441.f2441_26 = Math.max(0, l23 - l25);
      f1040.line_1e = f2441.f2441_26; // the ONLY way 1e is ever set
      // Credit prerequisites (lines 27–31):
      const l27 = expenseCap;
      f2441.f2441_27 = l27;
      const l28 = l24 + l25;
      f2441.f2441_28 = l28;
      const l29 = l27 - l28;
      f2441.f2441_29 = l29;
      const l30 = Math.max(0, careExpensesTotal - l28); // ledger-documented v1 approximation
      f2441.f2441_30 = l30;
      f2441.f2441_31 = l29 > 0 ? Math.min(l29, l30) : 0;
    }
  }
  // 1z sums 1a–1h with NULLs as 0 (1e only when Form 2441 produced it):
  const wagesTotal = wages1a + (f1040.line_1e ?? 0);
  if (w2s.length > 0 || f1040.line_1e !== undefined) f1040.line_1z = wagesTotal;

  // --------------------------- Income totals / AGI --------------------------
  // Lines 8/10 belong to Schedule 1 — blank when there's no business at all.
  if (companies.length > 0) {
    f1040.line_8 = s1.s1_10;
    f1040.line_10 = s1.s1_26;
  }
  f1040.line_9 = wagesTotal + s1.s1_10; // 2b,3b,4b,5b,6b,7a NULL -> 0
  f1040.line_11a = f1040.line_9 - s1.s1_26;
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
  const seniorTotal = (seniorEligibleSelf ? seniorAmt : 0) + (spouseSenior ? seniorAmt : 0);
  if (seniorTotal > 0) f1040.line_13b = seniorTotal; // blank unless it applies

  // Form 8995 QBI (needs taxable income BEFORE the QBI deduction).
  const taxableBeforeQbi = Math.max(0, f1040.line_11b - f1040.line_12e - seniorTotal);
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
  if (companies.length > 0) f1040.line_13a = qbiDeduction; // blank without a business

  f1040.line_14 = f1040.line_12e + qbiDeduction + seniorTotal;
  f1040.line_15 = Math.max(0, f1040.line_11b - f1040.line_14);

  // ------------------------------- Tax (16–18) ------------------------------
  f1040.line_16 = bracketTax(f1040.line_15, rules.brackets[st]);
  // line 17 (Schedule 2 Part I) is parked — stays BLANK, not 0.
  f1040.line_18 = f1040.line_16;

  // ------------------- Form 2441 Part II (credit) → Sch 3 line 2 ------------
  // MFS can't take the credit (form line A) — preparer applies the exception.
  if (ran2441 && st !== "mfs" && qualifyingPersons.length > 0) {
    const l3 =
      box10Total > 0 ? f2441.f2441_31 ?? 0 : Math.min(careExpensesTotal, expenseCap);
    f2441.f2441_3 = l3;
    f2441.f2441_4 = earnedSelf;
    const l5 = st === "mfj" ? spouseEarned : earnedSelf;
    f2441.f2441_5 = l5;
    const l6 = Math.max(0, Math.min(l3, earnedSelf, l5));
    f2441.f2441_6 = l6;
    f2441.f2441_7 = f1040.line_11a;
    const band = rules.f2441.agiDecimalTable.find((b) => f1040.line_11a <= b.upTo);
    const l8 = band.decimal;
    f2441.f2441_8 = l8;
    const l9a = r(l6 * l8);
    f2441.f2441_9a = l9a;
    const l9c = l9a; // 9b (prior-year expenses paid this year) v2 -> 0
    f2441.f2441_9c = l9c;
    const l10 = Math.max(0, f1040.line_18); // Credit Limit Wkst v1 = line 18
    f2441.f2441_10 = l10;
    s3_2 = Math.min(l9c, l10);
    f2441.f2441_11 = s3_2;
  } else if (ran2441 && st === "mfs" && careExpensesTotal > 0 && box10Total === 0) {
    flags.push("Married filing separately with childcare expenses — the credit isn't allowed unless the MFS exception applies (preparer).");
  }

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
    // Credit Limit Worksheet A = line 18 minus Schedule 3 lines 1–4… — the
    // 2441 credit (Sch 3 line 2) reduces the CTC headroom.
    const l13 = Math.max(0, f1040.line_18 - s3_2);
    line19 = Math.min(l12, l13);
    // Additional CTC (refundable), Part II-A:
    if (l12 > line19 && qc.length > 0) {
      const l16a = l12 - line19;
      const l16b = qc.length * rules.ctc.actcPerChild;
      const l17 = Math.min(l16a, l16b);
      const earned = Math.max(0, wagesTotal + s1.s1_3 - s1.s1_15);
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
  // Credit lines apply only when their schedules exist on this return.
  if (dependents.length > 0) f1040.line_19 = line19;
  if (ran2441) f1040.line_20 = s3_2; // Schedule 3 line 8 = line 2
  const credits21 = line19 + s3_2;
  if (dependents.length > 0 || ran2441) f1040.line_21 = credits21;
  f1040.line_22 = Math.max(0, f1040.line_18 - credits21); // form: "-0-" if zero
  if (seApplies) f1040.line_23 = se.se_12; // Schedule 2 line 21 v1 = SE tax
  f1040.line_24 = f1040.line_22 + se.se_12;

  // --------------------------- Payments (25–33) -----------------------------
  const w2Withheld = r(sum(w2s, (w) => w.box2));
  const n99Withheld = r(sum(f1099s, (n) => n.withheld));
  if (w2s.length > 0) f1040.line_25a = w2Withheld;
  if (f1099s.length > 0) f1040.line_25b = n99Withheld;
  f1040.line_25d = w2Withheld + n99Withheld; // 25c parked
  const estPay = num(snapshot.estimatedPayments);
  if (snapshot.estimatedPayments !== null && snapshot.estimatedPayments !== undefined) {
    f1040.line_26 = estPay; // blank until the input is actually collected
  }
  // line 27a (EIC) is NOT computed in v1 — stays blank; the flag says why.
  if (f1040.line_11a < rules.eicFlagAgiCeiling && (qc.length > 0 || f1040.line_11a < 20000)) {
    flags.push("Possible EIC eligibility (heuristic) — preparer review (line 27a).");
  }
  if (dependents.length > 0) {
    f1040.line_28 = line28;
    f1040.line_32 = line28; // 27a blank; 29,30,31 parked
  }
  f1040.line_33 = f1040.line_25d + estPay + line28;

  // --------------------------- Refund / owed (34–37) ------------------------
  // Only ONE side of the outcome is ever filled — the other stays blank, the
  // way a preparer fills the paper form (a printed 0 reads as a declaration).
  if (f1040.line_33 > f1040.line_24) {
    f1040.line_34 = f1040.line_33 - f1040.line_24;
    f1040.line_35a = f1040.line_34; // line 36 split parked
  } else if (f1040.line_24 > f1040.line_33) {
    f1040.line_37 = f1040.line_24 - f1040.line_33;
  }

  return {
    supported: true,
    method: "rate-schedule", // v1 note: IRS Tax Table (<$100k) may differ by a few dollars
    f1040,
    s1,
    se: seApplies ? se : { se_2: se.se_2, se_3: se.se_3, se_4a: se.se_4a, se_4c: se.se_4c, se_12: 0, se_13: 0 },
    f2441: ran2441 ? f2441 : {},
    flags,
  };
}

module.exports = {
  computeAll,
  bracketTax,
  isQualifyingChildAge,
  bornBeforeSeniorCutoff,
  isUnder13During,
};
