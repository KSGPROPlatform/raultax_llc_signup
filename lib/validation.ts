// Client-safe form validators. The password rules mirror the Entra External ID
// default policy (8–64 characters, at least 3 of: lowercase, uppercase, number,
// symbol) so the UI catches problems before Entra rejects the sign-up.

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "Email is required.";
  if (v.length > 254) return "That email is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address.";
  return null;
}

export function validateName(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (v.length < 2) return `${label} is too short.`;
  if (v.length > 128) return `${label} is too long.`;
  if (!/^[\p{L}][\p{L} '.-]*$/u.test(v)) {
    return `${label} can only contain letters, spaces, hyphens and apostrophes.`;
  }
  return null;
}

export type PasswordChecks = {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
};

export function passwordChecks(pw: string): PasswordChecks {
  return {
    length: pw.length >= 8 && pw.length <= 64,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export function categoriesMet(pw: string): number {
  const c = passwordChecks(pw);
  return [c.upper, c.lower, c.number, c.special].filter(Boolean).length;
}

// Entra rule: 8–64 characters AND at least 3 of the 4 character categories.
export function passwordMeetsPolicy(pw: string): boolean {
  return passwordChecks(pw).length && categoriesMet(pw) >= 3;
}

export function validatePassword(pw: string): string | null {
  if (!pw) return "Password is required.";
  const c = passwordChecks(pw);
  if (!c.length) {
    return pw.length < 8 ? "Use at least 8 characters." : "Use at most 64 characters.";
  }
  if (categoriesMet(pw) < 3) {
    return "Mix at least three of: uppercase, lowercase, number, symbol.";
  }
  return null;
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required.`;
}

// US ZIP: 5 digits, optionally +4 (e.g. 10001 or 10001-2345).
export function validateZip(value: string): string | null {
  const v = value.trim();
  if (!v) return "Postal code is required.";
  if (!/^\d{5}(-\d{4})?$/.test(v)) return "Enter a valid ZIP (e.g. 10001 or 10001-2345).";
  return null;
}

// Allowed birth-year window for an adult filer/spouse. Slides every year: in
// 2026 it's 1940–2016 (min age 10, max age 86), 1941–2017 in 2027, and so on —
// because it's derived from the current year, not hard-coded.
export function dobYearRange(currentYear: number): { min: number; max: number } {
  return { min: currentYear - 86, max: currentYear - 10 };
}

// Validate an MM/DD/YYYY date. When `range` is given, the year must fall inside it.
export function validateDob(
  value: string,
  range?: { min: number; max: number },
): string | null {
  if (!value.trim()) return "Date of birth is required.";
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "Enter the date as MM/DD/YYYY.";
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return "Enter a valid month (01–12).";
  if (dd < 1 || dd > 31) return "Enter a valid day.";
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return "That date doesn't exist.";
  }
  if (range && (yyyy < range.min || yyyy > range.max)) {
    return `Year of birth must be between ${range.min} and ${range.max}.`;
  }
  return null;
}

// 0..4 strength score for the meter.
export function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  const c = passwordChecks(pw);
  let score = categoriesMet(pw); // 0..4
  if (pw.length >= 12 && score >= 3) score = 4;
  if (!c.length) score = Math.min(score, 1);
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[Math.min(score, 4)] };
}
