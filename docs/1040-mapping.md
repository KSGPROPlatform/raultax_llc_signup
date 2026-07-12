# Form 1040 calculation mapping — living design ledger

The agreed design for computing a declaration's Form 1040. Built line by line
with Doane; **update this file as each line/sub-form is agreed**. Implementation
starts only from what is written here.

## Architecture (agreed)

- **`raul_tax_form_1040` table** — one row per declaration (`owner_oid + tax_year`
  unique), **one column per 1040 line** (`line_1a`, `line_1b`, …). Columns are
  added gradually as lines are agreed. `DECIMAL(18,2)`, **negatives allowed**
  (e.g. 1f). The 1040 uses **whole dollars** — round per IRS rules at output.
- **NULL vs 0**: `NULL` = "never collected / not applicable yet";
  `0` = "known to be zero". Sum lines treat NULL as 0.
- **BLANK-vs-ZERO on the filled form (Doane 2026-07-11)**: the engine SETS a
  line only when it applies to the return — inapplicable lines stay NULL and
  render BLANK everywhere (PDF, user page, admin panel shows "—", still
  overridable). A printed 0 reads as a declaration of zero, so: no W-2 → 1a/25a
  blank; no business → 8/10/13a/23 blank; no dependents → 19/28/32 blank; no
  2441 → 1e/20 blank; estimated payments not collected → 26 blank; EIC not
  computed → 27a blank; parked 17 blank; refund and owed are EITHER/OR — the
  other side stays blank. Exception: lines the form marks "-0-" when zero
  (15, 22) and core totals (9, 11a/11b, 12e, 14, 16, 18, 24, 25d, 33) always
  print. Each recompute NULL-clears managed columns absent from the output
  (calc1040 ENGINE_1040_COLS / F2441_COLS) so stale values never linger.
- **One deployed `calc1040` Azure Function**, internally one **small named
  function per line** (`line1a()`, `line1z()`, …). One data load per run (the
  year's snapshot: W-2/1099 extractions, P&L, dependents, spouse, declaration);
  later lines consume earlier lines' outputs.
- **Snapshot semantics**: the row carries `computed_at`; recompute on review-page
  open and on Submit. `frozen = 1` at submission — numbers stop changing.
- **Preparer overrides** (admin, later): per line, an optional override value +
  who/when. Override wins over computed; both are kept (audit trail).
- **`flags` column (JSON)**: every condition needing attention ("W-2 #2 box 1
  unreadable", "box 10 present → Form 2441 required → missing care details").
- **Sub-form tree pattern**: any 1040 line that references another form gets a
  **module** with the same shape (own columns + per-line functions), computed
  only when its **trigger** fires; its output line(s) feed the 1040. Triggers
  come from extracted document data wherever possible. A triggered form with
  missing inputs **flags — never guesses**.
- **Year constants** (deduction amounts, caps, phase-outs, brackets) live in a
  **per-year rules file** (2022–2025); formulas never hard-code them.
- **Visibility**: computed tax/refund numbers go to the **preparer first**
  (admin); released to the user after review.

## Data-quality rules (agreed)

1. **Upload gate**: a stored W-2/1099 is always complete — unreadable required
   money boxes (W-2 box 1/box 2) are rejected at upload with "upload a clearer
   copy", like the existing SSN/name/year/company gates. *(To implement.)*
2. **Submit gate**: submission is blocked until every required input exists,
   with a precise missing-items list. *(To implement.)*
3. **Preparer final word**: admin line-by-line review with overrides, then
   freeze → generate.

## Header / identity block (page 1, above Income) — mapping agreed

| 1040 field | Source | Status |
|---|---|---|
| Tax year | declaration.tax_year | done |
| First name + middle initial, last name | profile (middle blank if none) | done |
| Your SSN | profile.ssn (card- & W-2-verified) | done |
| Spouse name + SSN (MFJ **and** MFS) | spouse record (per year) | done — MFS collects name+SSN |
| Home address / city / state / ZIP | declaration (per year) | done |
| Filing status checkbox | declaration.filing_status | done |
| HOH/QSS child line, NRA spouse line | leave blank | agreed |
| Digital assets Yes/No | **skipped for now** (required by IRS — revisit) | parked |
| Dependents table (name, SSN, relationship) | dependents (per year); >4 → checkbox | done |
| Dependents' lived-with/student/disabled checkboxes | **deferred** (needed for credit split CTC vs ODC; DOB already collected) | parked |
| Presidential fund, main-home-in-US checkbox, spouse middle initial | skipped (cosmetic) | parked |

## Line ledger

### Line 1 (wages) — CLOSED
| Column | Formula | Trigger / source |
|---|---|---|
| `line_1a` | **Σ WagesTipsAndOtherCompensation (box 1) over the year's verified W-2 extractions** | computable now. Double-count impossible (one W-2 per job slot); year-scoped; a W-2 with unreadable box 1 → flag |
| `line_1b` | household employee wages | column only, NULL — data later |
| `line_1c` | tips not on 1a | column only, NULL |
| `line_1d` | Medicaid waiver payments | column only, NULL |
| `line_1e` | **Form 2441 line 26** | trigger: any W-2 **box 10 (DependentCareBenefits) > 0**. Missing inputs → flag |
| `line_1f` | **Form 8839 line 31** (can be NEGATIVE) | trigger: any W-2 **box 12 code T**. Missing inputs → flag |
| `line_1g` | **Form 8919 line 6** | soft trigger: **same firm appears on a W-2 and a 1099** in the year (reason code H); other codes = preparer. Missing inputs → flag |
| `line_1h` | other earned income | column only, NULL |
| `line_1i` | nontaxable combat pay election | column only, NULL (informational; NOT part of 1z) |
| `line_1z` | **Σ(1a…1h), NULL as 0** — currently equals 1a | computable now |

### Sub-form registry (modules to build when triggered lines go live)
| Form | Trigger | Outputs | Notes / year constants (2025) |
|---|---|---|---|
| **2441** (child & dependent care) | **BUILT (v1) — see "Form 2441 module" section** | line 26 → 1040 `1e`; line 11 → Schedule 3 line 2 → 1040 line 20 | ALWAYS COMPUTED when box 10 > 0 OR care expenses entered — box 10 is an input, never the 1e value (Doane 2026-07-11) |
| **8839** (adoption) | W-2 box 12 **code T** | line 31 → `1f`; line 13 → 1040 line 30; line 18 → Schedule 3 6c | needs children/adoption details; max $17,280/child; phase-out $259,190 / $40,000 |
| **8919** (uncollected SS/Medicare) | same firm on W-2 + 1099 (code H); else preparer | line 6 → `1g`; line 13 → Schedule 2 line 6 | SS wage cap $176,100; rates 6.2% / 1.45% |

### Lines 2–7 — PARKED (columns only, per Doane 2026-07-09)
Create the amount columns now, all NULL; formulas agreed later. Checkbox items
(3c, 4c, 5c, 6c, 6d, 7b) are noted but get no columns yet.

| Columns | Line |
|---|---|
| `line_2a`, `line_2b` | tax-exempt / taxable interest (future source: 1099-INT extractions; Schedule B trigger at > $1,500 taxable interest) |
| `line_3a`, `line_3b` | qualified / ordinary dividends (future source: 1099-DIV extractions) |
| `line_4a`, `line_4b` | IRA distributions / taxable amount (future source: 1099-R) |
| `line_5a`, `line_5b` | pensions & annuities / taxable amount (future source: 1099-R) |
| `line_6a`, `line_6b` | social security benefits / taxable amount |
| `line_7a` | capital gain/(loss) — negatives allowed (Schedule D — likely preparer/flag) |

### Line 8 — CLOSED: `line_8 = Schedule 1 line 10`
### Line 9 — CLOSED: `line_9 = 1z + 2b + 3b + 4b + 5b + 6b + 7a + 8` (NULL=0) — total income
### Line 10 — CLOSED: `line_10 = Schedule 1 line 26` (adjustments)

## Schedule 1 module — `raul_tax_schedule1` (one row per declaration; same pattern)
Sub-form tables mirror the 1040 table: (owner_oid, tax_year) unique, DECIMAL
columns, NULL semantics, per-line functions inside calc1040.

Part I — Additional income:
- top box (1099-K in error / personal items at a loss): parked; note 1099-K
  extractions as a future source.
- `s1_1`, `s1_2a`, `s1_4`, `s1_5`, `s1_6`, `s1_7`: columns only, NULL.
  (5 → Schedule E, 6 → Schedule F when ever needed — preparer/flag for now.)
- **`s1_3` = Σ per-company P&L nets for the year** — each company = one
  Schedule C; v1: Schedule C net = our P&L net (categories later); losses are
  negative; owns_establishment = No → no companies → NULL/0.
- `s1_8a` … `s1_8z`: columns only, NULL (8a/8d/8s enter as negatives when used).
- `s1_9` = Σ(8a…8z), NULL=0.
- **`s1_10` = (1 + 2a + 3 + 4 + 5 + 6 + 7) + 9 → 1040 `line_8`.**

Part II — Adjustments to income:
- `s1_11`–`s1_14`, `s1_16`–`s1_23`, `s1_24a`–`s1_24z`: columns only, NULL.
- **`s1_15` = deductible ½ of self-employment tax** — from **Schedule SE**
  (module to spec; triggers when total business net ≥ $400).
- `s1_25` = Σ(24a…24z); **`s1_26` = Σ(11…23) + 25 → 1040 `line_10`.**

### Sub-form registry additions
| Form | Trigger | Outputs | Notes |
|---|---|---|---|
| **Schedule 1** | always computed (cheap; mostly NULLs) | line 10 → 1040 `line_8`; line 26 → 1040 `line_10` | table `raul_tax_schedule1` |
| **Schedule C** (per company) | company with P&L exists | net → `s1_3` | v1: net = P&L net; full expense categories later |
| **Schedule SE** | Σ business nets ≥ $400 | ½ SE tax → `s1_15`; SE tax → Schedule 2 → 1040 line 23 | to spec with the tax section |

### Line 11a — CLOSED: `line_11a = line_9 − line_10` (AGI). Page 1 complete.

### Tax and Credits (11b–24) — CLOSED (v1 scope)
| Column | Formula |
|---|---|
| `line_11b` | = line_11a |
| 12a–12d | checkboxes: **age (born before Jan 2 of year−64)** computed from user/spouse DOB; blind, claimed-as-dependent, spouse-itemizes, dual-status → parked (preparer) |
| `line_12e` | **standard deduction from rules file by filing status** (2025 printed on form: Single/MFS 15,750; MFJ/QSS 31,500; HoH 23,625) **+ age-65 additions per rules file**; itemized (Schedule A) = preparer override |
| `line_13a` | QBI deduction — **Form 8995 module** (trigger: business net > 0); NULL until specced |
| `line_13b` | Schedule 1-A additional deductions; NULL |
| `line_14` | = 12e + 13a + 13b |
| `line_15` | = max(0, 11b − 14) — taxable income |
| `line_16` | **tax = bracket table lookup (rules file, per year + filing status)** |
| `line_17` | Schedule 2 line 3; NULL |
| `line_18` | = 16 + 17 |
| `line_19` | CTC/ODC — **Schedule 8812 module**: trigger = dependents; under-17 from DOB; amounts/phase-outs in rules file |
| `line_20` | Schedule 3 line 8; NULL (receives 2441 line 11, 8839 line 18 when built) |
| `line_21` | = 19 + 20 |
| `line_22` | = max(0, 18 − 21) |
| `line_23` | Schedule 2 line 21 — v1 ≈ **Schedule SE tax** when triggered; rest parked |
| `line_24` | = 22 + 23 — **total tax** |

**HARD RULE — rules-file integrity:** every non-form-printed constant (bracket
tables, age-65 additions, CTC amounts/phase-outs, SE caps) must be verified
against official IRS publications for that tax year AT IMPLEMENTATION TIME —
never written from memory.

### Tax & Credits sub-form specs (extracted from the uploaded 2025 forms —
### all constants below are PRINTED on the official forms = locked)

**Form 2441 module (BUILT v1, 2026-07-11) → `line_1e` + Schedule 3 line 2 → `line_20`.
Doctrine (Doane): ALWAYS COMPUTE — W-2 box 10 is only an INPUT to Part III;
line 1e is only ever the COMPUTED line 26 (frequently $0 when benefits are
fully excluded). Runs when Σ box 10 > 0 OR any dependent has care expenses.**

*New inputs:* per-dependent `care_expenses` (qualified expenses paid in the
year) + `is_disabled` (form 2(c): over-12 and unable to self-care); care
providers table (Part I: name, address, SSN/EIN, household-employee?, amount);
spouse `earned_income` (form lines 5/19, MFJ).
**Part I workflow (Doane, 2026-07-12): provider details are NOT captured in
the app** — the UI section was removed; the PREPARER collects the provider's
name/address/tax ID from the client at filing (the engine flags every 2441
return as a reminder). Backend (table, careProviders function, API routes,
snapshot loader) kept intact for re-enabling later. Qualifying person = dependent
under 13 (13th birthday > Jan 1 of year; turned-13-mid-year → flag: only
pre-birthday expenses qualify) OR `is_disabled`.

*Earned income (v1 definition, documented deviation):* self = Σ W-2 box 1 +
(SE ? net earnings (SE line 6) − ½ SE tax (S1 line 15) : 0); taxable benefits
(1e) NOT added back (conservative; preparer reviews — flag when SE present).
Spouse = the typed `earned_income` (MFJ). MFJ with expenses/box 10 but spouse
earned income missing → lines 5/19 = 0 → credit 0 and benefits fully taxable
+ flag ("never guess" rule; UI collects the field to avoid this).

*Part III (runs when Σ box 10 > 0):* 12 = Σ box 10; 13 = 0, 14 = 0
(grace-period carryover/forfeitures v2); 15 = 12+13−14; 16 = Σ qualifying
persons' care_expenses (uncapped); 17 = min(15,16); 18 = earned self;
19 = MFJ → spouse earned; **MFS → 0 (v1 conservative: all benefits taxable,
flag)**; else = 18; 20 = smallest(17,18,19); 21 = **$5,000** ($2,500 MFS);
22 = 0 (sole-prop/partnership DCAP v2); 23 = 15 − 22; 24 = smallest(20,21,22)
= 0 in v1; 25 = (22=0) → min(20,21); **26 = max(0, 23 − 25) → 1040 `line_1e`**
(NULL when the module never ran — not 0). `line_1z` = 1a + 1e now.
27 = **$3,000 / $6,000** (1 vs 2+ qualifying persons); 28 = 24 + 25;
29 = 27 − 28 (≤0 → stop, no credit); 30 = max(0, 16 − 28) [form: line-2
expenses excluding benefits — v1 approximation]; 31 = min(29,30) → line 3.

*Part II (credit; skipped for MFS — form line A, preparer exception only):*
3 = Part III ran ? line 31 : min(Σ expenses, $3,000/$6,000 cap);
4 = earned self; 5 = MFJ → spouse earned, else = 4; 6 = smallest(3,4,5);
7 = 1040 line 11a (AGI); 8 = decimal from the PRINTED table: ≤15k .35, then
−.01 per $2k band (15–17 .34 … 41–43 .21), >43k .20; 9a = 6 × 8; 9b = 0
(prior-year expenses paid this year v2); 9c = 9a + 9b; 10 = Credit Limit
Worksheet v1 = 1040 line 18 (no other pre-2441 credits computed);
**11 = min(9c, 10) → Schedule 3 line 2** (no Sch-3 table; the 2441 row stores
it) → `line_20` = Schedule 3 line 8 = line 2 (only Part I credit in v1).

*Downstream rewires:* 8812 line 13 (Credit Limit Wkst A) = line 18 − Sch3
line 2 (2441 credit reduces the CTC headroom); `line_21` = 19 + 20 unchanged.
*Gates/flags:* box 10 or expenses present but NO care provider row → flag
(Part I is mandatory); checkboxes A (MFS exception) & B (student/disabled
deemed income) = v2/preparer. Storage: `raul_tax_form_2441` row per
declaration (f2441_* columns) + `raul_tax_care_providers`.

**Schedule 8812 → `line_19` (+ `line_28` additional CTC). Trigger: dependents.**
- 3 = MAGI = 11a + exclusions (2a–2c parked)
- 4 = # qualifying children under 17 with required SSN (DOB + SSN collected);
  5 = 4 × **$2,200**
- 6 = # other dependents (rest; citizen/resident confirm = preparer);
  7 = 6 × **$500**; 8 = 5 + 7
- 9 = **$400,000 MFJ / $200,000 others**; 10 = max(0, 3 − 9) rounded UP to
  next $1,000; 11 = 10 × 5%
- 12 = 8 − 11 (≤ 0 → stop, no credit); 13 = Credit Limit Worksheet A (tax
  liability limit); **14 = min(12, 13) → 1040 line 19**
- Part II-A (refundable ACTC → 1040 line 28): 16a = 12 − 14; 16b = #QC ×
  **$1,700**; 17 = min(16a,16b); 19 = max(0, earned income − **$2,500**);
  20 = 19 × 15%; 27 per form flow (3+ children route Part II-B uses W-2
  boxes 4+6) → `line_28`.

**Schedule 2 → `line_17` (Part I line 3) and `line_23` (Part II line 21).**
- Part I: 1a–1y parked (1a = 8962 APTC repayment), 1z = Σ; 2 = AMT (6251,
  preparer); 3 = 1z + 2 → `line_17`.
- Part II: **4 = Schedule SE tax** (trigger: business net ≥ $400);
  **6 = Form 8919 line 13** (registered); 5, 8–19 parked;
  **21 = 4 + (7..16) + 18 + 19 → `line_23`** (v1: SE + 8919 when present).

**Schedule 3 → `line_20` (Part I line 8) and `line_31` (Part II line 15).**
- Part I: 2 = **2441 line 11**; 6c = **8839 line 18**; 1, 3, 4, 5a/5b,
  other 6x parked; 7 = Σ(6a–6z); **8 = 1+2+3+4+5a+5b+7 → `line_20`**.
- Part II: 9–14 parked (9 = 8962; 11 = excess SS — computable later from
  W-2 boxes 4 across employers); **15 → `line_31`**.

**Form 8995 (QBI simplified) → `line_13a`. Trigger: business net > 0 AND
taxable income before QBI ≤ $197,300 ($394,600 MFJ).**
- 2 = Σ business QBI (v1: Schedule C nets); 3 = prior-year carryforward
  (preparer); 4 = max(0, 2+3); 5 = 4 × 20%
- 6–9 REIT/PTP parked; 10 = 5 + 9
- 11 = **taxable income BEFORE QBI** (= 11b − 12e − 13b) ⇒ ORDERING:
  compute 12e and 13b before 8995, then 14 = 12e+13a+13b, then 15
- 12 = net capital gain + qualified dividends; 13 = max(0, 11 − 12);
  14 = 13 × 20%; **15 = min(10, 14) → `line_13a`**
- Over threshold → 8995-A (SSTB phase-in $197,300–$247,300 /
  $394,600–$494,600) → FLAG preparer, do not compute.

**Schedule 1-A (Additional Deductions) → `line_13b` (line 38).**
- Part I: 3 = MAGI = 11b + exclusions (parked → = 11b v1).
- Part II No-tax-on-TIPS: 4a = qualified tips from **W-2 box 7 (extracted)**
  — qualified-occupation confirm = preparer; 7 = min(6, **$25,000**);
  phase-out over **$150,000 ($300,000 MFJ)**: 12 = floor(excess/1000) ×
  **$100**; 13 = max(0, 7 − 12). Partially computable v1.
- Part III No-tax-on-OVERTIME: cap **$12,500 ($25,000 MFJ)**, same
  phase-out — parked (amount not separately collected).
- Part IV Car-loan interest: cap **$10,000**, phase-out over **$100,000
  ($200,000 MFJ)**, excess/1000 rounded UP × **$200** — parked.
- Part V Enhanced SENIOR deduction — **fully computable v1**: per person
  with valid SSN born before **Jan 2, 1961** (from DOBs): 35 = max(0,
  **$6,000** − 6% × max(0, MAGI − **$75,000/$150,000 MFJ**)); 37 = 36a+36b.
- **38 = 13 + 21 + 30 + 37 → `line_13b`.** (MFJ required for tips/OT/senior
  when married — per form cautions.)

**Schedule A (itemized) → alternative `line_12e`. Preparer-initiated v1.**
- Medical > 7.5% × 11b; SALT cap **$40,000 ($20,000 MFS)**, drops if 11b >
  $500k/$250k; mortgage interest from **Form 1098 (doc type 'mortgage'
  already collected/extractable — future automation)**; charity; 17 = total.

**Schedule SE (2025, uploaded) → table `raul_tax_schedule_se`. Trigger:
Σ business nets such that 4c ≥ $400. FULLY COMPUTABLE v1.**
- 1a/1b farm (Sch F) parked → 0; **2 = Σ company P&L nets (Schedule C)**
- 3 = 1a+1b+2; 4a = 3 > 0 ? 3 × **92.35%** : 3; 4b optional methods parked
  (Part II constants: $7,240 max, $7,840, $10,860, 72.189%); 4c = 4a+4b —
  **if < $400 → stop, no SE tax**
- 5a church income parked; 6 = 4c + 5b
- 7 = **$176,100** (2025); **8a = Σ W-2 (box 3 + box 7) — extracted**;
  8b (4137) parked; 8c ← Form 8919 line 10; 8d = 8a+8b+8c
- 9 = max(0, 7 − 8d); 10 = min(6, 9) × **12.4%**; 11 = 6 × **2.9%**
- **12 = 10 + 11 → Schedule 2 line 4 → 1040 line 23 (SE tax)**
- **13 = 12 × 50% → Schedule 1 line 15** (feeds 1040 line 10 → AGI)

**Computation order (dependency graph — CORRECTED: SE computes EARLY because
its line 13 feeds AGI):**
1z + Sch 1 Part I (business) → **Schedule SE** (needs only P&L + W-2 boxes
3/7) → Sch 1 Part II (s1_15 = SE line 13) → line 10 → 11a → 11b → 12a–d age
boxes (DOB) → 12e → 13b (Sch 1-A) → 8995 → 13a → 14 → 15 → 16 (brackets) →
Sch 2 Part I → 17 → 18 → 8812 → 19 → Sch 3 Part I → 20 → 21 → 22 →
Sch 2 Part II (SE line 12) → 23 → 24 → payments → 33 → 34/37.

**Column tally (agreed):** raul_tax_form_1040 = 57 line columns + ~9
bookkeeping (id, owner_oid, tax_year, computed_at, frozen, flags, overrides,
timestamps) ≈ 66. raul_tax_schedule1 ≈ 65. raul_tax_schedule_se ≈ 28.
Module tables (Sch 2/3, 8812, 8995) created with their modules.

### Payments & Refundable Credits (25–33) — CLOSED (v1 scope)
| Column | Formula |
|---|---|
| `line_25a` | **Σ W-2 box 2 (FederalIncomeTaxWithheld) over the year's verified W-2s** |
| `line_25b` | Σ federal withholding from the year's verified 1099 extractions |
| `line_25c` | parked |
| `line_25d` | = 25a + 25b + 25c |
| `line_26` | estimated payments — parked; needs one input field later; preparer override meanwhile |
| `line_27a` | EIC — module later; v1 flags likely-eligible returns for preparer (tables per year, eligibility tests) |
| `line_28` | additional CTC ← Schedule 8812 Part II-A |
| `line_29` | parked (Form 8863) |
| `line_30` | refundable adoption credit ← Form 8839 line 13 |
| `line_31` | ← Schedule 3 line 15 |
| `line_32` | = 27a + 28 + 29 + 30 + 31 |
| `line_33` | = 25d + 26 + 32 — total payments |

### Refund / Amount Owed (34–38) — CLOSED (v1 scope)
| Column | Formula |
|---|---|
| `line_34` | max(0, 33 − 24) — overpaid |
| `line_35a` | refund (v1 = 34; line 36 split parked) |
| 35b/35c/35d | direct deposit ← bank record (routing/account collected & verified). **GAP: add Checking/Savings selector to the bank form** |
| `line_36` | parked |
| `line_37` | max(0, 24 − 33) — amount owed |
| `line_38` | parked (penalty — preparer) |

## THE FULL 1040 IS MAPPED (v1)
End-to-end computable chain from collected data:
W-2 box 1 → 1a/1z; P&L → Sch C → Sch 1 → 8; 9; 10; 11a/11b; std deduction
(rules) + senior deduction (Sch 1-A P.V) → 12e/13b; QBI 8995 → 13a; 14; 15;
brackets → 16; 18; 8812 → 19/28; 20; 21; 22; Sch SE → 23; **24 total tax**;
W-2 box 2 → 25a/25d; 32; **33 total payments**; **34 refund / 37 owed** +
direct deposit.

Remaining small inputs to add when implementing: estimated payments (26),
Checking/Savings on bank form (35c), digital-assets Y/N (header, parked),
dependent checkboxes (credit split confirm).

## Forms inventory
Uploaded & specced (2025 editions): 1040, Sch 1, Sch 1-A, Sch 2, Sch 3,
Sch 8812, Sch A, F2441, F8839, F8919, F8995 (+8995-A Sch A).
**MISSING & NEEDED for v1: Schedule SE** (SE tax — Sch 2 line 4, Sch 1
line 15). Referenced but parked (no form needed for v1): 8863, 6251, 8962,
8880, 5695, 4137, 8959, 8960, full Schedule C.
From the 1040 INSTRUCTIONS at build time (VERIFY rule): tax bracket tables
(line 16), additional std deduction 65+/blind, 8812 Credit Limit Worksheet A,
EIC tables.

## Version roadmap (agreed with Doane, 2026-07-09)

**V1 — the common return, end to end** (W-2 earners + small business,
standard deduction):
1. Schema: raul_tax_form_1040 + schedule tables (all agreed columns).
2. Rules files 2022–2025 (constants VERIFIED against IRS at build time).
3. calc1040 per-line engine: 1a/1z → Sch1/business → 9 → 11a/11b →
   12e (+age boxes) + Sch1-A senior (+tips partial) + 8995 QBI → 15 →
   16 (brackets) → 8812 CTC → Sch SE → 24 → 25a/25b/25d → 33 → 34/37 +
   direct deposit; flags everywhere else.
4. Gates: W-2 box1/box2 required at upload; Submit completeness gate.
5. Inputs added: bank Checking/Savings (35c); estimated payments (26).
6. Preparer review page (admin, per year): computed + sources + flags +
   overrides; freeze on approve; user sees numbers only after approval.
7. Golden test suite of hand-computed returns.

**V2**: lines 2/3 via 1099-INT/DIV + Schedule B; EIC; 8863; 8839/8919
modules (2441 SHIPPED 2026-07-11 — pulled forward; leftovers: grace-period
carryovers 13/14, prior-year expenses 9b, sole-prop DCAP 22, student/disabled
deemed income, MFS exceptions); dependent checkboxes; digital assets Q;
Schedule C categories; 1099-NEC→Sch C; user refund reveal.
(Filled-1040 PDF also shipped 2026-07-09.)

**V3**: Sch D/8949, Sch E, Sch F; Schedule A automation via 1098 extraction;
AMT/8959/8960/8995-A; cross-year carryforwards (QBI losses, adoption credit);
yearly rules-file onboarding process.

Forms to upload at v2 start: Schedule B, Schedule EIC, Form 8863, full Sch C.

## Implementation status
- 2026-07-09: mapping complete; roadmap agreed; Schedule SE specced.
- 2026-07-09 (build): **DONE** — `azure-functions/sql/create_1040_tables.sql`
  (3 tables); `src/taxRules/2025.js` (all constants sourced: printed forms +
  IRS.gov + Tax Foundation post-OBBBA; resolver refuses unverified years);
  `src/taxEngine.js` (pure per-line engine per this ledger);
  `test/taxEngine.test.js` (3 hand-computed golden returns + guards —
  **36/36 pass**). v1 engine notes: tax via rate schedule (IRS Tax Table under
  $100k may differ by a few dollars — preparer reviews); QBI = Schedule C net
  (simplification); blindness boxes = preparer override.
- **NEXT**: Doane runs create_1040_tables.sql → calc1040 HTTP function
  (snapshot loader + engine + upsert + overrides/freeze) → preparer review
  page (admin) → user review + submit gate. Rules for 2022–2024: add when
  verified (engine refuses them until then).
- 2026-07-09 (filled OFFICIAL PDF — v2 item pulled forward): **DONE** —
  the download IS the IRS's own fillable f1040.pdf (2025 revision) with our
  values written into its AcroForm fields, then flattened.
  - `lib/pdf/f1040-2025-b64.ts`: pristine official PDF, base64-embedded
    (one template per year; other years 404 until their template + rules
    are verified).
  - `lib/pdf/fill1040.ts`: field map (built by stamping every field with its
    own name and reading the render): amounts `line_1a→f1_47 … line_38→f2_36`;
    filing status = checkbox group `c1_8` exports 1=Single 2=MFJ 3=MFS 4=HOH
    (Single/MFJ/MFS under `Checkbox_ReadOrder[0]`, HOH under `Page1[0]`);
    senior boxes `c2_5` (you) / `c2_7` (spouse); dependents rows
    f1_31–46 + CTC/ODC boxes c1_28–31 (split mirrors engine line 19);
    SSN/routing/account are comb fields (f1_16, f1_19, f1_39–42, f2_32,
    f2_33) — pdf-lib can't comb-space, so digits are DRAWN one per cell.
    Overrides win (same eff() as the review panel); NULL lines stay blank;
    direct deposit only when line 34 > 0; diagonal "DRAFT — PENDING
    PREPARER REVIEW" watermark until frozen.
  - `app/api/tax-return/pdf/route.ts` (session-gated, recomputes first,
    frozen respected) + "Download IRS Form 1040" button on
    /dashboard/return. Visually verified on MFJ-draft and MFS-approved
    renders.
- 2026-07-11 (Form 2441 module): **DONE** — always computed (box 10 = input
  only; 1e = computed line 26). `sql/create_2441_tables.sql` (form table +
  care providers + dependent/spouse column adds — Doane runs FIRST);
  `taxRules/2025.js` f2441 constants (all printed on the form);
  `taxEngine.js` Part III→1e→1z + Part II→Sch3 line 2→line 20 + 8812 limit
  −s3_2; golden tests 4–6 (full exclusion→1e=0, tax-limited credit,
  MFS all-taxable) + guards; `calc1040.js` snapshot (providers, care
  expenses, disabled, spouse earned income) + f2441 upsert + stale-row
  clear; `careProviders` function + app CRUD; DependentForm care fields,
  CareProvidersSection, SpouseForm earned income; lines 1e/20 in displays.
