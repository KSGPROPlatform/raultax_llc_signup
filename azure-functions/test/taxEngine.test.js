// Golden tests for the 1040 engine — expected values HAND-COMPUTED from the
// ledger formulas + verified 2025 constants. The engine must match exactly.
// Run: node azure-functions/test/taxEngine.test.js
const { computeAll } = require("../src/taxEngine");

let failures = 0;
function expectEq(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 1 — Single, one W-2 (wages 50,000 / withheld 6,000):");
// 1a=1z=9=11a=50,000; 12e=15,750; 15=34,250
// 16 = 11,925×10% + 22,325×12% = 1,192.50 + 2,679 = 3,871.50 → 3,872
// 24=3,872; 33=6,000; refund 34 = 2,128
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Single",
    birthDateSelf: "06/15/1990",
    w2s: [{ box1: 50000, box2: 6000, box3: 50000, box7: 0, employer: "Acme" }],
    companies: [],
    dependents: [],
  });
  expectEq("line_1a", out.f1040.line_1a, 50000);
  expectEq("line_9", out.f1040.line_9, 50000);
  expectEq("line_11a", out.f1040.line_11a, 50000);
  expectEq("line_12e", out.f1040.line_12e, 15750);
  expectEq("line_15", out.f1040.line_15, 34250);
  expectEq("line_16", out.f1040.line_16, 3872);
  expectEq("line_24", out.f1040.line_24, 3872);
  expectEq("line_25a", out.f1040.line_25a, 6000);
  expectEq("line_34 (refund)", out.f1040.line_34, 2128);
  // BLANK-vs-ZERO: inapplicable lines stay absent (blank on the form).
  expectEq("line_37 BLANK on a refund return", out.f1040.line_37, undefined);
  expectEq("line_8 BLANK (no business)", out.f1040.line_8, undefined);
  expectEq("line_17 BLANK (parked)", out.f1040.line_17, undefined);
  expectEq("line_19 BLANK (no dependents)", out.f1040.line_19, undefined);
  expectEq("line_23 BLANK (no SE)", out.f1040.line_23, undefined);
  expectEq("line_26 BLANK (not collected)", out.f1040.line_26, undefined);
  expectEq("line_27a BLANK (EIC not computed)", out.f1040.line_27a, undefined);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 2 — MFJ, W-2 60,000/5,000 + business +10,000 + 2 kids <17:");
// SE: 4a=9,235; 10=round(9,235×12.4%)=1,145; 11=round(267.815)=268; 12=1,413; 13=707
// Sch1: 3=10,000; 15=707 → 1040: 8=10,000; 9=70,000; 10=707; 11a=69,293
// 12e=31,500; QBI: min(2,000, round(20%×37,793)=7,559)=2,000 → 13a=2,000
// 14=33,500; 15=35,793; 16 = 2,385 + 11,943×12% = 3,818.16 → 3,818
// 8812: 8=4,400 > 16? credit limited to line 18 → 19=3,818; 22=0; 23=1,413; 24=1,413
// ACTC: 16a=582; 16b=3,400; earned=69,293 → 20=10,019 → 28=582
// payments: 25a=5,000; 32=582; 33=5,582 → refund 34=4,169
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Married filing jointly",
    birthDateSelf: "03/10/1985",
    birthDateSpouse: "07/22/1987",
    w2s: [{ box1: 60000, box2: 5000, box3: 60000, box7: 0, employer: "Blue Beacon" }],
    companies: [{ net: 10000, name: "Farm LLC" }],
    dependents: [
      { dob: "04/01/2015", hasSsn: true },
      { dob: "09/12/2018", hasSsn: true },
    ],
  });
  expectEq("se_12 (SE tax)", out.se.se_12, 1413);
  expectEq("se_13 (half)", out.se.se_13, 707);
  expectEq("s1_15", out.s1.s1_15, 707);
  expectEq("line_8", out.f1040.line_8, 10000);
  expectEq("line_11a (AGI)", out.f1040.line_11a, 69293);
  expectEq("line_13a (QBI)", out.f1040.line_13a, 2000);
  expectEq("line_15", out.f1040.line_15, 35793);
  expectEq("line_16", out.f1040.line_16, 3818);
  expectEq("line_19 (CTC)", out.f1040.line_19, 3818);
  expectEq("line_22", out.f1040.line_22, 0);
  expectEq("line_23 (SE)", out.f1040.line_23, 1413);
  expectEq("line_24 (total tax)", out.f1040.line_24, 1413);
  expectEq("line_28 (ACTC)", out.f1040.line_28, 582);
  expectEq("line_33 (payments)", out.f1040.line_33, 5582);
  expectEq("line_34 (refund)", out.f1040.line_34, 4169);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 3 — Single SENIOR (b.1955), business only +30,000, no W-2:");
// SE: 4a=27,705; 10=round(3,435.42)=3,435; 11=round(803.445)=803; 12=4,238; 13=2,119
// 9=30,000; 10=2,119; 11a=27,881; 12e=15,750+2,000=17,750
// senior deduction: MAGI<75,000 → 6,000 → 13b=6,000
// QBI: taxable before = 4,131 → min(6,000, round(826.2)=826)=826 → 13a=826
// 14=24,576; 15=3,305; 16=round(330.5)=331; 24=331+4,238=4,569 → owed 4,569
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Single",
    birthDateSelf: "05/20/1955",
    w2s: [],
    companies: [{ net: 30000, name: "Consulting" }],
    dependents: [],
  });
  expectEq("se_12", out.se.se_12, 4238);
  expectEq("line_11a", out.f1040.line_11a, 27881);
  expectEq("line_12e (std + age box)", out.f1040.line_12e, 17750);
  expectEq("line_13b (senior deduction)", out.f1040.line_13b, 6000);
  expectEq("line_13a (QBI capped)", out.f1040.line_13a, 826);
  expectEq("line_15", out.f1040.line_15, 3305);
  expectEq("line_16", out.f1040.line_16, 331);
  expectEq("line_24", out.f1040.line_24, 4569);
  expectEq("line_37 (owed)", out.f1040.line_37, 4569);
  // BLANK-vs-ZERO: a business-only filer has no wage/withholding/refund lines.
  expectEq("line_1a BLANK (no W-2)", out.f1040.line_1a, undefined);
  expectEq("line_25a BLANK (no W-2)", out.f1040.line_25a, undefined);
  expectEq("line_34 BLANK on an owed return", out.f1040.line_34, undefined);
  expectEq("line_23 SET (SE applies)", out.f1040.line_23, 4238);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 4 — Form 2441 MFJ: box 10 = 5,000 FULLY EXCLUDED (1e = 0):");
// Wages 60,000, box10 5,000, spouse earned 30,000, kids 5 & 8 w/ SSN,
// care expenses 4,000 + 4,000, provider on file.
// Part III: 12=15=5,000; 16=8,000; 17=5,000; 18=60,000; 19=30,000; 20=5,000
// 21=5,000; 24=0; 25=5,000 → 26=0 → line 1e = 0 (box 10 NEVER lands raw!)
// 27=6,000; 28=5,000; 29=1,000; 30=3,000; 31=1,000
// 1z=60,000; AGI=60,000; 12e=31,500; 15=28,500; 16 = 2,385+558 = 2,943
// Part II: 3=1,000; 6=1,000; 7=60,000 → .20 → 9a=200; 10=2,943 → 11=200 → line 20=200
// 8812: 8=4,400; 13=2,943−200=2,743 → 19=2,743; ACTC: 16a=1,657; 16b=3,400 → 28=1,657
// 21=2,943; 22=0; 24=0; 33=4,000+1,657=5,657 → refund 5,657
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Married filing jointly",
    birthDateSelf: "06/15/1988",
    birthDateSpouse: "02/20/1990",
    w2s: [{ box1: 60000, box2: 4000, box3: 60000, box7: 0, box10: 5000, employer: "Acme" }],
    companies: [],
    dependents: [
      { dob: "05/01/2020", hasSsn: true, careExpenses: 4000 },
      { dob: "03/15/2017", hasSsn: true, careExpenses: 4000 },
    ],
    careProviders: [{ name: "Sunny Days Daycare", amountPaid: 8000 }],
    spouseEarnedIncome: 30000,
  });
  expectEq("f2441_12 (benefits in)", out.f2441.f2441_12, 5000);
  expectEq("f2441_25 (excluded)", out.f2441.f2441_25, 5000);
  expectEq("f2441_26 (taxable)", out.f2441.f2441_26, 0);
  expectEq("line_1e = COMPUTED 0, not box 10", out.f1040.line_1e, 0);
  expectEq("line_1z", out.f1040.line_1z, 60000);
  expectEq("f2441_31 -> line 3", out.f2441.f2441_31, 1000);
  expectEq("f2441_8 (decimal)", out.f2441.f2441_8, 0.20);
  expectEq("f2441_11 (credit)", out.f2441.f2441_11, 200);
  expectEq("line_20 (Sch 3)", out.f1040.line_20, 200);
  expectEq("line_19 (CTC after 2441 limit)", out.f1040.line_19, 2743);
  expectEq("line_28 (ACTC)", out.f1040.line_28, 1657);
  expectEq("line_22", out.f1040.line_22, 0);
  expectEq("line_34 (refund)", out.f1040.line_34, 5657);
  expectEq("no provider flag (provider on file)", out.flags.some((f) => f.includes("Form 2441 Part I")), false);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 5 — Form 2441 Single: expenses only, credit capped by tax:");
// Wages 20,000, no box 10, kid age 4, care 2,500, provider on file.
// No Part III → 1e stays NULL. 3=2,500; 6=2,500; AGI 20,000 → .32 → 9a=800
// tax: 15=4,250 → 16=425 → credit 11 = min(800, 425) = 425 → line 20 = 425
// 8812: 12=2,200; 13=425−425=0 → 19=0; ACTC 16a=2,200; 16b=1,700 → 28=1,700
// 33=500+1,700=2,200 → refund 2,200
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Single",
    birthDateSelf: "05/05/1995",
    w2s: [{ box1: 20000, box2: 500, box3: 20000, box7: 0, employer: "Shop" }],
    companies: [],
    dependents: [{ dob: "07/04/2021", hasSsn: true, careExpenses: 2500 }],
    careProviders: [{ name: "Little Steps", amountPaid: 2500 }],
  });
  expectEq("line_1e stays NULL (no Part III)", out.f1040.line_1e, undefined);
  expectEq("f2441_3", out.f2441.f2441_3, 2500);
  expectEq("f2441_8 (decimal .32)", out.f2441.f2441_8, 0.32);
  expectEq("f2441_9a", out.f2441.f2441_9a, 800);
  expectEq("f2441_11 (tax-limited)", out.f2441.f2441_11, 425);
  expectEq("line_20", out.f1040.line_20, 425);
  expectEq("line_19 (CTC crowded out)", out.f1040.line_19, 0);
  expectEq("line_28 (ACTC)", out.f1040.line_28, 1700);
  expectEq("line_34 (refund)", out.f1040.line_34, 2200);
}

// ---------------------------------------------------------------------------
console.log("GOLDEN 6 — Form 2441 MFS: benefits fully TAXABLE, credit denied:");
// Wages 40,000, box10 3,000, kid age 6 care 3,000, provider on file, MFS.
// Part III: 19=0 → 20=0 → 25=0 → 26=3,000 → 1e=3,000; 1z=43,000
// Part II skipped (MFS) → line 20 = 0
// 12e=15,750; 15=27,250; 16 = 1,192.50+1,839 = 3,031.50 → 3,032
// 8812: 12=2,200; 13=3,032 → 19=2,200; 16a=0 → 28=0; 22=832; 24=832
// 33=3,500 → refund 2,668
{
  const out = computeAll({
    taxYear: 2025,
    filingStatus: "Married filing separately",
    birthDateSelf: "01/10/1992",
    w2s: [{ box1: 40000, box2: 3500, box3: 40000, box7: 0, box10: 3000, employer: "Ora" }],
    companies: [],
    dependents: [{ dob: "08/08/2019", hasSsn: true, careExpenses: 3000 }],
    careProviders: [{ name: "ABC Kids", amountPaid: 3000 }],
  });
  expectEq("f2441_26 (all taxable)", out.f2441.f2441_26, 3000);
  expectEq("line_1e", out.f1040.line_1e, 3000);
  expectEq("line_1z includes 1e", out.f1040.line_1z, 43000);
  expectEq("line_20 (no MFS credit)", out.f1040.line_20, 0);
  expectEq("line_16", out.f1040.line_16, 3032);
  expectEq("line_19 (CTC)", out.f1040.line_19, 2200);
  expectEq("line_24", out.f1040.line_24, 832);
  expectEq("line_34 (refund)", out.f1040.line_34, 2668);
  expectEq("MFS taxable-benefits flag", out.flags.some((f) => f.includes("treats all benefits as taxable")), true);
}

// ---------------------------------------------------------------------------
console.log("GUARDS:");
{
  const un = computeAll({ taxYear: 2024, filingStatus: "Single", w2s: [], companies: [], dependents: [] });
  expectEq("unsupported year -> supported", un.supported, false);
  const noStatus = computeAll({ taxYear: 2025, filingStatus: "", w2s: [], companies: [], dependents: [] });
  expectEq("missing status flagged", noStatus.flags.some((f) => f.includes("Filing status")), true);
  const trigger = computeAll({
    taxYear: 2025, filingStatus: "Single", birthDateSelf: "01/01/1990",
    w2s: [{ box1: 1000, box2: 0, box3: 1000, box7: 0, box10: 3000, employer: "X" }],
    companies: [], dependents: [],
  });
  expectEq("2441 trigger flagged (box 10)", trigger.flags.some((f) => f.includes("2441")), true);
  // Box 10 with NO care details: everything taxable + provider flag.
  expectEq("box10 w/o expenses -> 1e all taxable", trigger.f1040.line_1e, 3000);
  expectEq("box10 w/o provider -> Part I flag", trigger.flags.some((f) => f.includes("Form 2441 Part I")), true);
  // MFJ with box 10 but NO spouse earned income: conservative + explicit flag.
  const noSpouse = computeAll({
    taxYear: 2025, filingStatus: "Married filing jointly", birthDateSelf: "01/01/1990",
    w2s: [{ box1: 30000, box2: 0, box3: 30000, box7: 0, box10: 2000, employer: "Y" }],
    companies: [], dependents: [{ dob: "01/01/2020", hasSsn: true, careExpenses: 2000 }],
    careProviders: [{ name: "Z", amountPaid: 2000 }],
  });
  expectEq("MFJ missing spouse income -> benefits taxable", noSpouse.f1040.line_1e, 2000);
  expectEq("MFJ missing spouse income flag", noSpouse.flags.some((f) => f.includes("SPOUSE's earned income")), true);
}

console.log(failures === 0 ? "\nALL GOLDEN TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
