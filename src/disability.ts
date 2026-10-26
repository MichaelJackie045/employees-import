import type { DisabilityYesNo } from "./types.js";

const YES = new Set(["y", "yes", "true", "1", "disabled"]);

/** Blank / null / unknown ? "No". */
export function toDisabilityYesNo(value: unknown): DisabilityYesNo {
  if (value === null || value === undefined) return "No";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value === 1 ? "Yes" : "No";

  const s = String(value).trim().toLowerCase();
  if (s === "") return "No";
  if (YES.has(s)) return "Yes";
  return "No";
}
