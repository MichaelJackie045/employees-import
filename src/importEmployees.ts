import { z } from "zod";
import { toDisabilityYesNo } from "./disability.js";
import { validateSaId } from "./saId.js";
import type {
  EmployeeRow,
  ExistingEmployee,
  ExceptionRow,
  ImportHeader,
  ImportResult,
} from "./types.js";

export const EmployeeRowSchema = z.object({
  emp_no: z.union([z.string(), z.null()]).optional(),
  name: z.union([z.string(), z.null()]).optional(),
  id_number: z.union([z.string(), z.null()]).optional(),
  disability: z.unknown().optional(),
  monthly_ctc: z.union([z.number(), z.string(), z.null()]).optional(),
});

export const ExistingEmployeeSchema = z.object({
  emp_no: z.string(),
  name: z.string(),
  id_number: z.string(),
  disability: z.enum(["Yes", "No"]),
  monthly_ctc: z.number(),
});

export const ImportHeaderSchema = z.object({
  peopleCount: z.number().int().nonnegative(),
  totalMonthlyCtc: z.number().nonnegative(),
});

export const ImportEmployeesInputSchema = z.object({
  rows: z.array(EmployeeRowSchema),
  existing: z.array(ExistingEmployeeSchema),
  header: ImportHeaderSchema,
});

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export function parseMonthlyCtc(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = value.replace(/[\s,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mergeEmployee(
  existing: ExistingEmployee,
  file: {
    emp_no?: string | null;
    name?: string | null;
    id_number: string;
    disabilityRaw: unknown;
    monthly_ctc: number;
  },
): ExistingEmployee {
  return {
    emp_no: isBlank(file.emp_no) ? existing.emp_no : String(file.emp_no).trim(),
    name: isBlank(file.name) ? existing.name : String(file.name).trim(),
    id_number: isBlank(file.id_number)
      ? existing.id_number
      : file.id_number.trim(),
    // Blank disability in file must not overwrite existing
    disability: isBlank(file.disabilityRaw)
      ? existing.disability
      : toDisabilityYesNo(file.disabilityRaw),
    monthly_ctc: file.monthly_ctc,
  };
}

function findExisting(
  existing: ExistingEmployee[],
  idNumber: string,
  empNo: string | null | undefined,
): ExistingEmployee | undefined {
  const byId = existing.find((e) => e.id_number === idNumber);
  if (byId) return byId;
  if (!isBlank(empNo)) {
    const no = String(empNo).trim();
    return existing.find((e) => e.emp_no === no);
  }
  return undefined;
}

/**
 * Import payroll rows against existing employees and client control totals.
 * Invalid IDs/CTC go to exceptions and never block other rows.
 * Blank file values never overwrite existing. Control mismatch refuses the import.
 */
export function importEmployees(
  rows: EmployeeRow[],
  existing: ExistingEmployee[],
  header: ImportHeader,
): ImportResult {
  const parsed = ImportEmployeesInputSchema.safeParse({
    rows,
    existing,
    header,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input: " + parsed.error.message };
  }

  const {
    rows: safeRows,
    existing: safeExisting,
    header: safeHeader,
  } = parsed.data;

  const exceptions: ExceptionRow[] = [];
  const matched: ExistingEmployee[] = [];
  const created: ExistingEmployee[] = [];
  const matchedKeys = new Set<string>();

  const keyOf = (e: ExistingEmployee) => `${e.id_number}::${e.emp_no}`;

  for (const row of safeRows) {
    if (isBlank(row.id_number)) {
      exceptions.push({ row, reason: "Missing ID number" });
      continue;
    }

    const idNumber = String(row.id_number).replace(/\s+/g, "");
    const idResult = validateSaId(idNumber);
    if (!idResult.ok) {
      exceptions.push({ row, reason: idResult.reason });
      continue;
    }

    const ctc = parseMonthlyCtc(row.monthly_ctc);
    if (ctc === null) {
      exceptions.push({ row, reason: "Invalid monthly_ctc" });
      continue;
    }

    const found = findExisting(safeExisting, idNumber, row.emp_no);

    if (found) {
      const merged = mergeEmployee(found, {
        emp_no: row.emp_no,
        name: row.name,
        id_number: idNumber,
        disabilityRaw: row.disability,
        monthly_ctc: ctc,
      });
      matched.push(merged);
      matchedKeys.add(keyOf(found));
    } else {
      const empNo = isBlank(row.emp_no) ? idNumber : String(row.emp_no).trim();
      const name = isBlank(row.name) ? "" : String(row.name).trim();
      created.push({
        emp_no: empNo,
        name,
        id_number: idNumber,
        disability: toDisabilityYesNo(row.disability),
        monthly_ctc: ctc,
      });
    }
  }

  const leavers = safeExisting.filter((e) => !matchedKeys.has(keyOf(e)));

  const peopleCount = matched.length + created.length;
  const totalMonthlyCtc = [...matched, ...created].reduce(
    (sum, e) => sum + e.monthly_ctc,
    0,
  );

  if (
    peopleCount !== safeHeader.peopleCount ||
    totalMonthlyCtc !== safeHeader.totalMonthlyCtc
  ) {
    return {
      ok: false,
      error: "Control totals do not match header",
      exceptions,
    };
  }

  return {
    ok: true,
    matched,
    new: created,
    leavers,
    exceptions,
    controls: { peopleCount, totalMonthlyCtc },
  };
}
