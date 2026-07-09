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
  expectEq("line_37 (owed)", out.f1040.line_37, 0);
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
}

console.log(failures === 0 ? "\nALL GOLDEN TESTS PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
