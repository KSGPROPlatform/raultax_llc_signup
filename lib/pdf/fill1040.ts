// Fills the OFFICIAL IRS Form 1040 PDF with a computed return — the download
// is the IRS's own file with our values written into its form fields, then
// flattened. Field names were mapped from the 2025 revision's AcroForm (see
// docs/1040-mapping.md). Amounts come in as the EFFECTIVE values (preparer
// overrides already applied); NULL lines stay blank on the form.

import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import { F1040_2025_BASE64 } from "./f1040-2025-b64";

// One template per verified tax year (the layout changes yearly).
const TEMPLATES: Record<number, string> = { 2025: F1040_2025_BASE64 };
export const hasF1040Template = (year: number) => Boolean(TEMPLATES[year]);

export type Fill1040Data = {
  taxYear: number;
  frozen: boolean; // approved by the preparer — no watermark
  /** Effective line values keyed by raul_tax_form_1040 column (line_1a …). */
  values: Record<string, number | null | undefined>;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  ssn?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  filingStatus?: string | null;
  seniorSelf?: boolean; // born before Jan 2 of (taxYear − 64)
  seniorSpouse?: boolean;
  spouse?: { firstName?: string | null; lastName?: string | null; ssn?: string | null } | null;
  dependents?: { fullName: string; ssn?: string | null; relationship?: string | null; ctc: boolean }[];
  occupation?: string | null;
  bank?: { routing?: string | null; account?: string | null } | null;
};

const P1 = "topmostSubform[0].Page1[0].";

// line column -> field short name (f1_* = page 1, f2_* = page 2), mapped by
// stamping every field with its own name and reading the render.
const AMOUNT_FIELDS: [string, string][] = [
  ["line_1a", "f1_47"], ["line_1b", "f1_48"], ["line_1c", "f1_49"],
  ["line_1d", "f1_50"], ["line_1e", "f1_51"], ["line_1f", "f1_52"],
  ["line_1g", "f1_53"], ["line_1h", "f1_55"], ["line_1i", "f1_56"],
  ["line_1z", "f1_57"],
  ["line_2a", "f1_58"], ["line_2b", "f1_59"], ["line_3a", "f1_60"], ["line_3b", "f1_61"],
  ["line_4a", "f1_62"], ["line_4b", "f1_63"], ["line_5a", "f1_65"], ["line_5b", "f1_66"],
  ["line_6a", "f1_68"], ["line_6b", "f1_69"], ["line_7a", "f1_70"],
  ["line_8", "f1_72"], ["line_9", "f1_73"], ["line_10", "f1_74"], ["line_11a", "f1_75"],
  ["line_11b", "f2_01"], ["line_12e", "f2_02"], ["line_13a", "f2_03"], ["line_13b", "f2_04"],
  ["line_14", "f2_05"], ["line_15", "f2_06"], ["line_16", "f2_08"], ["line_17", "f2_09"],
  ["line_18", "f2_10"], ["line_19", "f2_11"], ["line_20", "f2_12"], ["line_21", "f2_13"],
  ["line_22", "f2_14"], ["line_23", "f2_15"], ["line_24", "f2_16"],
  ["line_25a", "f2_17"], ["line_25b", "f2_18"], ["line_25c", "f2_19"], ["line_25d", "f2_20"],
  ["line_26", "f2_21"], ["line_27a", "f2_23"], ["line_28", "f2_24"], ["line_29", "f2_25"],
  ["line_30", "f2_26"], ["line_31", "f2_27"], ["line_32", "f2_28"], ["line_33", "f2_29"],
  ["line_34", "f2_30"], ["line_35a", "f2_31"], ["line_36", "f2_34"],
  ["line_37", "f2_35"], ["line_38", "f2_36"],
];

// Filing status is one checkbox group (c1_8) split across two containers, so
// these need fully qualified names (export values 1–4).
const FILING_STATUS_BOXES: Record<string, string> = {
  Single: `${P1}Checkbox_ReadOrder[0].c1_8[0]`,
  "Married filing jointly": `${P1}Checkbox_ReadOrder[0].c1_8[1]`,
  "Married filing separately": `${P1}Checkbox_ReadOrder[0].c1_8[2]`,
  "Head of household": `${P1}c1_8[0]`,
};

// Dependents table (first four rows): first name, last name, SSN comb,
// relationship, and the credit checkboxes (…[0] = child tax credit, …[1] =
// credit for other dependents).
const DEP_FIELDS = [
  { first: "f1_31", last: "f1_35", ssn: "f1_39", rel: "f1_43", ctc: "c1_28[0]", odc: "c1_28[1]" },
  { first: "f1_32", last: "f1_36", ssn: "f1_40", rel: "f1_44", ctc: "c1_29[0]", odc: "c1_29[1]" },
  { first: "f1_33", last: "f1_37", ssn: "f1_41", rel: "f1_45", ctc: "c1_30[0]", odc: "c1_30[1]" },
  { first: "f1_34", last: "f1_38", ssn: "f1_42", rel: "f1_46", ctc: "c1_31[0]", odc: "c1_31[1]" },
];

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const money = (n: number) => Math.round(n).toLocaleString("en-US");

export async function fill1040Pdf(data: Fill1040Data): Promise<Uint8Array> {
  const b64 = TEMPLATES[data.taxYear];
  if (!b64) throw new Error(`No official 1040 template for ${data.taxYear}`);

  const doc = await PDFDocument.load(Buffer.from(b64, "base64"), { updateMetadata: false });
  const form = doc.getForm();
  const pages = doc.getPages();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Index fields by short name (unique except c1_8, addressed fully above).
  const byShort = new Map<string, PDFTextField | PDFCheckBox>();
  for (const f of form.getFields()) {
    const short = f.getName().split(".").pop()!.replace(/\[0\]$/, "");
    if (!byShort.has(short) && (f instanceof PDFTextField || f instanceof PDFCheckBox)) {
      byShort.set(short, f);
    }
    const withIdx = f.getName().split(".").pop()!;
    if (!byShort.has(withIdx) && (f instanceof PDFTextField || f instanceof PDFCheckBox)) {
      byShort.set(withIdx, f);
    }
  }

  const setText = (short: string, value: string | null | undefined, size = 8) => {
    if (value === null || value === undefined || value === "") return;
    const f = byShort.get(short);
    if (!(f instanceof PDFTextField)) return;
    try {
      const max = f.getMaxLength();
      f.setText(max ? String(value).slice(0, max) : String(value));
      f.setFontSize(size);
    } catch {
      /* never let one bad box kill the download */
    }
  };

  // Comb boxes (SSNs, routing/account): pdf-lib can't lay out one char per
  // cell, so draw the characters straight onto the page instead.
  const drawComb = (short: string, value: string | null | undefined) => {
    const v = (value ?? "").trim();
    const f = byShort.get(short);
    if (!v || !(f instanceof PDFTextField)) return;
    const widget = f.acroField.getWidgets()[0];
    const rect = widget.getRectangle();
    const pageIdx = pages.findIndex((p) => p.ref === widget.P());
    if (pageIdx < 0) return;
    const cells = f.getMaxLength() ?? v.length;
    const cellW = rect.width / cells;
    const size = Math.min(9, rect.height - 2);
    for (let i = 0; i < Math.min(v.length, cells); i++) {
      const ch = v[i];
      const w = helv.widthOfTextAtSize(ch, size);
      pages[pageIdx].drawText(ch, {
        x: rect.x + i * cellW + (cellW - w) / 2,
        y: rect.y + (rect.height - size) / 2 + 1,
        size,
        font: helv,
      });
    }
  };

  const check = (nameOrShort: string) => {
    try {
      const f = byShort.get(nameOrShort) ?? form.getCheckBox(nameOrShort);
      if (f instanceof PDFCheckBox) f.check();
    } catch {
      /* ignore */
    }
  };

  // ---- Identity (page 1 header) ----
  const firstAndMiddle = [data.firstName, data.middleName ? data.middleName[0].toUpperCase() : null]
    .filter(Boolean)
    .join(" ");
  setText("f1_14", firstAndMiddle, 9);
  setText("f1_15", data.lastName, 9);
  drawComb("f1_16", digits(data.ssn));
  setText("f1_20", data.street, 9);
  setText("f1_22", data.city, 9);
  setText("f1_23", data.state, 9);
  setText("f1_24", data.zip, 9);

  // ---- Filing status + spouse ----
  const fs = (data.filingStatus ?? "").trim();
  const fsBox = FILING_STATUS_BOXES[fs];
  if (fsBox) check(fsBox);
  if (data.spouse) {
    drawComb("f1_19", digits(data.spouse.ssn)); // spouse SSN box serves MFJ and MFS
    const spouseName = [data.spouse.firstName, data.spouse.lastName].filter(Boolean).join(" ");
    if (fs === "Married filing jointly") {
      setText("f1_17", data.spouse.firstName, 9);
      setText("f1_18", data.spouse.lastName, 9);
    } else if (fs === "Married filing separately") {
      setText("f1_28", spouseName, 8); // "Enter spouse's SSN above and full name here"
    }
  }

  // ---- Dependents (first four; extra ones tick the "more than four" box) ----
  const deps = data.dependents ?? [];
  if (deps.length > 4) check("c1_11");
  deps.slice(0, 4).forEach((d, i) => {
    const slot = DEP_FIELDS[i];
    const parts = d.fullName.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : "";
    setText(slot.first, parts.join(" "), 7);
    setText(slot.last, last, 7);
    drawComb(slot.ssn, digits(d.ssn));
    setText(slot.rel, d.relationship, 7);
    check(d.ctc ? slot.ctc : slot.odc); // matches the engine's line-19 split
  });

  // ---- Age/blindness block (page 2, 12d) ----
  if (data.seniorSelf) check("c2_5");
  if (data.seniorSpouse) check("c2_7");

  // ---- Amounts (NULL = never collected stays blank) ----
  for (const [key, short] of AMOUNT_FIELDS) {
    const v = data.values[key];
    if (typeof v === "number" && Number.isFinite(v)) setText(short, money(v), 8);
  }

  // ---- Direct deposit (only when there is a refund) ----
  const refund = data.values["line_34"];
  if (typeof refund === "number" && refund > 0 && data.bank) {
    drawComb("f2_32", digits(data.bank.routing).slice(0, 9));
    drawComb("f2_33", (data.bank.account ?? "").replace(/\s/g, "").slice(0, 17));
  }

  // ---- Occupation (signature block) ----
  setText("f2_40", data.occupation, 8);

  // Bake values into the page so the file prints identically everywhere.
  try {
    form.updateFieldAppearances(helv);
    form.flatten();
  } catch {
    /* extremely defensive: an unflattenable field still leaves a valid PDF */
  }

  // Until the preparer approves, every page carries a DRAFT watermark.
  if (!data.frozen) {
    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText("DRAFT — PENDING PREPARER REVIEW", {
        x: width / 2 - 245,
        y: height / 2 - 130,
        size: 26,
        font: helvBold,
        color: rgb(0.72, 0.72, 0.72),
        opacity: 0.45,
        rotate: degrees(38),
      });
    }
  }

  return doc.save();
}
