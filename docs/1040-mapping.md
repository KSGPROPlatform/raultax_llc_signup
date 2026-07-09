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
| **2441** (child & dependent care) | W-2 box 10 > 0 (or user childcare expenses) | line 26 → 1040 `1e`; line 11 → Schedule 3 line 2 | needs care providers + per-child expenses (not collected); expense caps $3,000/$6,000; AGI decimal table |
| **8839** (adoption) | W-2 box 12 **code T** | line 31 → `1f`; line 13 → 1040 line 30; line 18 → Schedule 3 6c | needs children/adoption details; max $17,280/child; phase-out $259,190 / $40,000 |
| **8919** (uncollected SS/Medicare) | same firm on W-2 + 1099 (code H); else preparer | line 6 → `1g`; line 13 → Schedule 2 line 6 | SS wage cap $176,100; rates 6.2% / 1.45% |

### Line 2 (interest) — NEXT, under discussion
Sources available today: 1099-INT extractions (when uploaded). To be mapped.

## Discussion status
- 2026-07-09: header block + line 1 fully mapped and closed. Next: line 2
  (2a tax-exempt / 2b taxable interest), then 3 (dividends), 4–6 (retirement/SS),
  7 (capital gains — likely flag-only), 8 (Schedule 1: business income from the
  per-company P&L), 9–11 (totals/AGI).
