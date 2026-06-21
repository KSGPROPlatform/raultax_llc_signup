// Catalog of tax document slots (Form 5). Shared by the web vault, the mobile
// upload page, and the server upload helpers — pure data, safe to import from
// both client and server. Each file in raul_tax_files carries its `doc_type`
// (one of these keys, or null/"other" for an uncategorised upload).

export type DocType = {
  key: string;
  label: string;
  multiple: boolean; // false = one file per user (re-upload replaces it)
  hint?: string;
};

export const DOC_TYPES: DocType[] = [
  { key: "ssn_copy", label: "Copy of SSN", multiple: false, hint: "Social Security card" },
  { key: "spouse_ssn_copy", label: "Spouse SSN document", multiple: false, hint: "Spouse's Social Security card" },
  { key: "id_front", label: "ID — Front", multiple: false, hint: "Driver's licence / passport" },
  { key: "id_back", label: "ID — Back", multiple: false },
  { key: "w2", label: "W-2", multiple: true },
  { key: "w4", label: "W-4", multiple: true },
  { key: "form_1099", label: "1099", multiple: true, hint: "Any 1099 forms" },
  { key: "mortgage", label: "Mortgage statement", multiple: true },
  { key: "form_1095", label: "1095", multiple: true, hint: "Health coverage" },
  { key: "tuition", label: "Tuition (1098-T)", multiple: true },
];

// Key used to group uncategorised / legacy uploads.
export const OTHER_DOC = { key: "other", label: "Other documents", multiple: true } as const;

const BY_KEY = new Map(DOC_TYPES.map((d) => [d.key, d]));

export function isKnownDocType(key: string): boolean {
  return BY_KEY.has(key);
}

export function isMultiple(key: string | null): boolean {
  if (!key) return true; // "other"
  return BY_KEY.get(key)?.multiple ?? true;
}

export function docTypeLabel(key: string | null): string {
  if (!key) return OTHER_DOC.label;
  return BY_KEY.get(key)?.label ?? OTHER_DOC.label;
}

// What the file inputs accept (images for phone photos + PDFs).
export const DOC_ACCEPT = "image/*,application/pdf";
