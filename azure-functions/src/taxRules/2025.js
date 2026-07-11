// Tax year 2025 rules — every constant sourced & verified (docs/1040-mapping.md
// hard rule). Sources:
//  [FORM]  printed on the official 2025 IRS form uploaded by the preparer
//  [IRS]   irs.gov/filing/federal-income-tax-rates-and-brackets (fetched 2026-07-09)
//  [TF]    taxfoundation.org 2025 brackets page (fetched 2026-07-09; post-OBBBA)
// Filing status keys: single | mfj | mfs | hoh.

module.exports = {
  year: 2025,

  // [FORM 1040 sidebar] Standard deduction (post-OBBBA amounts printed on form)
  standardDeduction: { single: 15750, mfs: 15750, mfj: 31500, hoh: 23625 },

  // [TF] Additional standard deduction per checked box (age 65+ / blind),
  // line 12d. Married rate applies to MFJ and MFS; unmarried rate to single/HoH.
  additionalStdDeduction: { single: 2000, hoh: 2000, mfj: 1600, mfs: 1600 },

  // [IRS][TF] 2025 rate schedules — progressive; upTo = top of bracket.
  brackets: {
    single: [
      { upTo: 11925, rate: 0.10 }, { upTo: 48475, rate: 0.12 },
      { upTo: 103350, rate: 0.22 }, { upTo: 197300, rate: 0.24 },
      { upTo: 250525, rate: 0.32 }, { upTo: 626350, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    mfj: [
      { upTo: 23850, rate: 0.10 }, { upTo: 96950, rate: 0.12 },
      { upTo: 206700, rate: 0.22 }, { upTo: 394600, rate: 0.24 },
      { upTo: 501050, rate: 0.32 }, { upTo: 751600, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    mfs: [
      { upTo: 11925, rate: 0.10 }, { upTo: 48475, rate: 0.12 },
      { upTo: 103350, rate: 0.22 }, { upTo: 197300, rate: 0.24 },
      { upTo: 250525, rate: 0.32 }, { upTo: 375800, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    hoh: [
      { upTo: 17000, rate: 0.10 }, { upTo: 64850, rate: 0.12 },
      { upTo: 103350, rate: 0.22 }, { upTo: 197300, rate: 0.24 },
      { upTo: 250500, rate: 0.32 }, { upTo: 626350, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
  },

  // [FORM Schedule 8812] Child tax credit / other dependents / additional CTC
  ctc: {
    perQualifyingChild: 2200,     // line 5
    perOtherDependent: 500,       // line 7
    phaseOutThreshold: { mfj: 400000, single: 200000, mfs: 200000, hoh: 200000 }, // line 9
    phaseOutRate: 0.05,           // line 11
    actcPerChild: 1700,           // line 16b
    actcEarnedIncomeFloor: 2500,  // line 19
    actcRate: 0.15,               // line 20
    actcPartIIBThreshold: 5100,   // "is line 16b $5,100 or more?"
  },

  // [FORM Schedule SE]
  se: {
    netEarningsFactor: 0.9235,    // line 4a
    minimumNetEarnings: 400,      // line 4c stop rule
    ssWageCap: 176100,            // line 7 (also Form 8919 line 7)
    ssRate: 0.124,                // line 10
    medicareRate: 0.029,          // line 11
    deductionFactor: 0.5,         // line 13
  },

  // [FORM 8995] QBI simplified computation
  qbi: {
    rate: 0.20,
    taxableIncomeLimit: { single: 197300, mfs: 197300, hoh: 197300, mfj: 394600 },
  },

  // [FORM Schedule 1-A Part V] Enhanced senior deduction (OBBBA)
  seniorDeduction: {
    perPerson: 6000,
    phaseOutStart: { mfj: 150000, single: 75000, mfs: 75000, hoh: 75000 },
    phaseOutRate: 0.06,
    // Born before Jan 2 of (year − 64): for 2025, before 1961-01-02.
  },

  // [FORM 2441] Child & dependent care — every number is PRINTED on the form.
  f2441: {
    expenseCapOne: 3000,          // lines 3/27 — one qualifying person
    expenseCapTwoPlus: 6000,      // lines 3/27 — two or more
    exclusionLimit: 5000,         // line 21
    exclusionLimitMfs: 2500,      // line 21 (MFS with spouse earned income required)
    // Line 8 decimal table: AGI (line 7) "over / but not over" bands.
    agiDecimalTable: [
      { upTo: 15000, decimal: 0.35 }, { upTo: 17000, decimal: 0.34 },
      { upTo: 19000, decimal: 0.33 }, { upTo: 21000, decimal: 0.32 },
      { upTo: 23000, decimal: 0.31 }, { upTo: 25000, decimal: 0.30 },
      { upTo: 27000, decimal: 0.29 }, { upTo: 29000, decimal: 0.28 },
      { upTo: 31000, decimal: 0.27 }, { upTo: 33000, decimal: 0.26 },
      { upTo: 35000, decimal: 0.25 }, { upTo: 37000, decimal: 0.24 },
      { upTo: 39000, decimal: 0.23 }, { upTo: 41000, decimal: 0.22 },
      { upTo: 43000, decimal: 0.21 }, { upTo: Infinity, decimal: 0.20 },
    ],
  },

  // Heuristic only (flagging, not computation): AGI under this + likely EIC.
  eicFlagAgiCeiling: 70000,
};
