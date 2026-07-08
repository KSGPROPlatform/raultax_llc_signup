import "server-only";
import { cookies } from "next/headers";
import { TAX_YEAR_COOKIE, resolveTaxYear } from "./taxYear";

// The tax year the signed-in user is currently declaring (set by
// /api/declarations, clamped to the allowed window). Route handlers use it to
// scope every per-year read/write.
export async function activeTaxYear(): Promise<number> {
  const jar = await cookies();
  return resolveTaxYear(jar.get(TAX_YEAR_COOKIE)?.value);
}
