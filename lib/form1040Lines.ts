// Display metadata for the computed Form 1040 — shared by the preparer review
// panel and the user's filled-form view. Keys match raul_tax_form_1040 columns.

export type LineDef = [key: string, label: string];

export const FORM_1040_SECTIONS: { title: string; lines: LineDef[] }[] = [
  {
    title: "Income",
    lines: [
      ["line_1a", "1a — Wages (from your W-2s, box 1)"],
      ["line_1e", "1e — Taxable dependent care benefits (Form 2441)"],
      ["line_1z", "1z — Total wages"],
      ["line_8", "8 — Additional income (business)"],
      ["line_9", "9 — Total income"],
    ],
  },
  {
    title: "Adjustments & deductions",
    lines: [
      ["line_10", "10 — Adjustments to income"],
      ["line_11a", "11a — Adjusted gross income"],
      ["line_12e", "12e — Standard deduction"],
      ["line_13a", "13a — Qualified business income deduction"],
      ["line_13b", "13b — Additional deductions"],
      ["line_14", "14 — Total deductions"],
      ["line_15", "15 — Taxable income"],
    ],
  },
  {
    title: "Tax and credits",
    lines: [
      ["line_16", "16 — Tax"],
      ["line_18", "18 — Tax before credits"],
      ["line_19", "19 — Child tax credit / other dependents"],
      ["line_20", "20 — Child & dependent care credit (Schedule 3)"],
      ["line_22", "22 — Tax after credits"],
      ["line_23", "23 — Other taxes (self-employment)"],
      ["line_24", "24 — TOTAL TAX"],
    ],
  },
  {
    title: "Payments",
    lines: [
      ["line_25a", "25a — Federal tax withheld (W-2)"],
      ["line_25b", "25b — Federal tax withheld (1099)"],
      ["line_25d", "25d — Total withholding"],
      ["line_26", "26 — Estimated tax payments"],
      ["line_28", "28 — Additional child tax credit"],
      ["line_32", "32 — Other payments & refundable credits"],
      ["line_33", "33 — TOTAL PAYMENTS"],
    ],
  },
  {
    title: "Refund / Amount owed",
    lines: [
      ["line_34", "34 — Overpaid (refund)"],
      ["line_37", "37 — Amount you owe"],
    ],
  },
];

export const FORM_1040_LINES: LineDef[] = FORM_1040_SECTIONS.flatMap((s) => s.lines);

// Bold/emphasized rows in displays.
export const FORM_1040_STRONG = new Set(["line_24", "line_33", "line_34", "line_37"]);
