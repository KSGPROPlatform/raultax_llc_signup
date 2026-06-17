// Mask a sensitive value for display, keeping only the last few characters.
// e.g. maskTail("123456789") -> "•••• 6789"
export function maskTail(value: string | null | undefined, keep = 4): string {
  const v = (value ?? "").trim();
  if (!v) return "—";
  if (v.length <= keep) return "••••";
  return `•••• ${v.slice(-keep)}`;
}
