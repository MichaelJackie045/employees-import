export type SaIdResult = { ok: true } | { ok: false; reason: string };

function isRealDate(yy: number, mm: number, dd: number): boolean {
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;

  const now = new Date();
  const currentYY = now.getFullYear() % 100;
  // Pivot: if YY is greater than current two-digit year, treat as 1900s; else 2000s.
  const fullYear = yy > currentYY ? 1900 + yy : 2000 + yy;

  const d = new Date(Date.UTC(fullYear, mm - 1, dd));
  return (
    d.getUTCFullYear() === fullYear &&
    d.getUTCMonth() === mm - 1 &&
    d.getUTCDate() === dd
  );
}

/** Luhn check over all 13 digits (from the right). */
export function luhnOk(id: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let i = id.length - 1; i >= 0; i--) {
    let d = Number(id[i]);
    if (doubleDigit) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

/**
 * SA ID: 13 digits, real YYMMDD, citizenship digit (index 10) 0 or 1, Luhn check digit.
 */
export function validateSaId(raw: string): SaIdResult {
  const id = raw.replace(/\s+/g, "");
  if (!/^\d{13}$/.test(id)) {
    return { ok: false, reason: "ID must be 13 digits" };
  }

  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  if (!isRealDate(yy, mm, dd)) {
    return { ok: false, reason: "Invalid date of birth in ID" };
  }

  const citizenship = id[10];
  if (citizenship !== "0" && citizenship !== "1") {
    return { ok: false, reason: "Invalid citizenship digit" };
  }

  if (!luhnOk(id)) {
    return { ok: false, reason: "Invalid ID check digit" };
  }

  return { ok: true };
}

/** Build a valid 13-digit SA ID for tests (fixed sequence/citizenship/A, computed check digit). */
export function makeValidSaId(
  yymmdd: string,
  sequence = "5000",
  citizenship: "0" | "1" = "0",
  a = "8",
): string {
  const base12 = `${yymmdd}${sequence}${citizenship}${a}`;
  for (let check = 0; check <= 9; check++) {
    const candidate = base12 + String(check);
    if (luhnOk(candidate)) return candidate;
  }
  throw new Error("Could not compute Luhn check digit");
}
