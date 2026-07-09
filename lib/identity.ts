import "server-only";
import { getSpouse, getUserProfile } from "./profileData";
import { listFiles, getExtraction } from "./files";
import { activeTaxYear } from "./activeYear";

// TEMP: only used by the disabled SSN cross-check below — restore with it.
// const digitsOf = (v: unknown) => String(v ?? "").replace(/\D/g, "");

// The typed first AND last name must both appear as tokens in the card's name
// (case-insensitive, any order — tolerates middle names/initials on the card).
function nameMatches(expectedName: string, cardName: string): boolean {
  const cardTokens = new Set(
    cardName.toLowerCase().split(/[^a-z]+/).filter(Boolean),
  );
  const expected = expectedName.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (!expected.length || !cardTokens.size) return false;
  return expected.every((t) => cardTokens.has(t));
}

// The identity an SSN card must match at ANALYZE time. The values TYPED in the
// form win (they're what the user intends to save — comparing against a stale
// saved SSN would falsely reject a just-corrected number); the saved record
// fills any blanks. Final consistency is enforced separately at SAVE time by
// cardConsistencyError below.
export async function resolveExpectedIdentity(
  oid: string,
  docType: string,
  provided?: { name?: string | null; ssn?: string | null },
): Promise<{ name: string; ssn: string }> {
  let name = (provided?.name ?? "").trim();
  let ssn = (provided?.ssn ?? "").trim();
  if (!name || !ssn) {
    if (docType === "spouse_ssn_copy") {
      const s = await getSpouse(oid, await activeTaxYear());
      if (!name) name = [s?.first_name, s?.last_name].filter(Boolean).join(" ");
      if (!ssn) ssn = (s?.ssn ?? "").trim();
    } else {
      const p = await getUserProfile(oid);
      if (!name) name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
      if (!ssn) ssn = (p?.ssn ?? "").trim();
    }
  }
  return { name: name.trim(), ssn };
}

// SAVE-time guard: if a verified SSN card is already on file, the identity being
// saved must match it — otherwise someone could upload a matching card and then
// quietly change the number before saving. Returns a user-facing error message,
// or null when consistent (or when there's no card/extraction to compare).
export async function cardConsistencyError(
  oid: string,
  docType: "ssn_copy" | "spouse_ssn_copy",
  saving: { name?: string; ssn?: string },
): Promise<string | null> {
  try {
    const files = await listFiles(oid);
    const card = files.find((f) => f.doc_type === docType);
    if (!card) return null;
    const ex = await getExtraction(oid, card.id);
    if (!ex || ex.status !== "done" || !ex.fields_json) return null;
    let fields: Record<string, unknown> = {};
    try {
      fields = JSON.parse(ex.fields_json) as Record<string, unknown>;
    } catch {
      return null;
    }
    const who = docType === "spouse_ssn_copy" ? "your spouse's" : "your";

    // TEMP DISABLED per Doane (2026-07-09) — SSN cross-check off everywhere
    // for now (also in analyzeDocument's gates); re-enable by uncommenting.
    // const cardSsn = digitsOf(fields.ssn);
    // const savedSsn = digitsOf(saving.ssn);
    // if (cardSsn && savedSsn && cardSsn !== savedSsn) {
    //   return `The Social Security number doesn't match ${who} uploaded SSN card — update the number or replace the card.`;
    // }
    const cardName = String(fields.name ?? "").trim();
    const savingName = (saving.name ?? "").trim();
    if (cardName && savingName && !nameMatches(savingName, cardName)) {
      return `The name doesn't match ${who} uploaded SSN card — update it or replace the card.`;
    }
    return null;
  } catch {
    // The guard must never break saving when the file backend hiccups.
    return null;
  }
}
