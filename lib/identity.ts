import "server-only";
import { getSpouse, getUserProfile } from "./profileData";
import { activeTaxYear } from "./activeYear";

// The identity an SSN card must match: the user's own profile for ssn_copy, the
// spouse record for spouse_ssn_copy. Saved data wins; the form's typed values
// (from the still-unsaved Form 1 / Spouse form) are the fallback — used by the
// upload precondition and passed server-to-server to the analyze function.
export async function resolveExpectedIdentity(
  oid: string,
  docType: string,
  provided?: { name?: string | null; ssn?: string | null },
): Promise<{ name: string; ssn: string }> {
  let name = "";
  let ssn = "";
  if (docType === "spouse_ssn_copy") {
    const s = await getSpouse(oid, await activeTaxYear());
    name = [s?.first_name, s?.last_name].filter(Boolean).join(" ");
    ssn = s?.ssn ?? "";
  } else {
    const p = await getUserProfile(oid);
    name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
    ssn = p?.ssn ?? "";
  }
  if (!name.trim() && provided?.name) name = provided.name;
  if (!ssn.trim() && provided?.ssn) ssn = provided.ssn;
  return { name: name.trim(), ssn: ssn.trim() };
}
