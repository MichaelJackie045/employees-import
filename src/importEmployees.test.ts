import { describe, expect, it } from "vitest";
import { toDisabilityYesNo } from "./disability.js";
import { importEmployees } from "./importEmployees.js";
import { makeValidSaId, validateSaId } from "./saId.js";
import type { ExistingEmployee } from "./types.js";

describe("toDisabilityYesNo", () => {
  it('maps "N" to No', () => {
    expect(toDisabilityYesNo("N")).toBe("No");
  });

  it('maps "Yes" to Yes', () => {
    expect(toDisabilityYesNo("Yes")).toBe("Yes");
  });

  it('maps "no" to No', () => {
    expect(toDisabilityYesNo("no")).toBe("No");
  });

  it('maps "TRUE" to Yes', () => {
    expect(toDisabilityYesNo("TRUE")).toBe("Yes");
  });

  it("maps blank / null / undefined to No", () => {
    expect(toDisabilityYesNo("")).toBe("No");
    expect(toDisabilityYesNo(null)).toBe("No");
    expect(toDisabilityYesNo(undefined)).toBe("No");
  });

  it('maps "Disabled" to Yes', () => {
    expect(toDisabilityYesNo("Disabled")).toBe("Yes");
  });
});

describe("validateSaId", () => {
  const valid = makeValidSaId("800101");

  it("accepts a valid 13-digit ID", () => {
    expect(validateSaId(valid)).toEqual({ ok: true });
  });

  it("rejects wrong length", () => {
    expect(validateSaId("123").ok).toBe(false);
  });

  it("rejects impossible date (990230…)", () => {
    const result = validateSaId("9902305800086");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/date/i);
  });

  it("rejects bad check digit", () => {
    const bad = valid.slice(0, 12) + (valid[12] === "0" ? "1" : "0");
    const result = validateSaId(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/check digit/i);
  });

  it("rejects citizenship digit not 0 or 1", () => {
    const base = makeValidSaId("800101", "5000", "0", "8");
    // Force citizenship (index 10) to 9 and recompute is unnecessary — just mutate
    const digits = base.split("");
    digits[10] = "9";
    // Fix Luhn so we isolate citizenship failure: try all check digits
    let found = false;
    for (let c = 0; c <= 9; c++) {
      digits[12] = String(c);
      const id = digits.join("");
      const result = validateSaId(id);
      if (!result.ok && result.reason.includes("citizenship")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("importEmployees", () => {
  const idA = makeValidSaId("800101");
  const idB = makeValidSaId("920220");
  const idC = makeValidSaId("050615");

  const existingA: ExistingEmployee = {
    emp_no: "E001",
    name: "T. Nkosi",
    id_number: idA,
    disability: "No",
    monthly_ctc: 30000,
  };

  const existingB: ExistingEmployee = {
    emp_no: "E002",
    name: "A. Pillay",
    id_number: idB,
    disability: "Yes",
    monthly_ctc: 40000,
  };

  it("matches by id_number before emp_no", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E002", // would match B by emp_no
          name: "Renamed",
          id_number: idA, // but id matches A
          disability: "N",
          monthly_ctc: 32500,
        },
      ],
      [existingA, existingB],
      { peopleCount: 1, totalMonthlyCtc: 32500 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].id_number).toBe(idA);
    expect(result.matched[0].name).toBe("Renamed");
  });

  it("matches by emp_no when id is new", () => {
    const newId = makeValidSaId("771231");
    const result = importEmployees(
      [
        {
          emp_no: "E001",
          name: "T. Nkosi",
          id_number: newId,
          disability: "N",
          monthly_ctc: 32500,
        },
      ],
      [existingA],
      { peopleCount: 1, totalMonthlyCtc: 32500 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].emp_no).toBe("E001");
    expect(result.matched[0].id_number).toBe(newId);
  });

  it("treats unmatched file row as new", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E099",
          name: "New Person",
          id_number: idC,
          disability: "Disabled",
          monthly_ctc: 19750,
        },
      ],
      [existingA],
      { peopleCount: 1, totalMonthlyCtc: 19750 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.new).toHaveLength(1);
    expect(result.new[0].disability).toBe("Yes");
    expect(result.leavers).toHaveLength(1);
  });

  it("reports leavers when existing missing from file", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E002",
          name: "A. Pillay",
          id_number: idB,
          disability: "Yes",
          monthly_ctc: 41200,
        },
      ],
      [existingA, existingB],
      { peopleCount: 1, totalMonthlyCtc: 41200 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leavers.map((e) => e.emp_no)).toEqual(["E001"]);
  });

  it("does not overwrite existing name with blank", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E001",
          name: "",
          id_number: idA,
          disability: "N",
          monthly_ctc: 32500,
        },
      ],
      [existingA],
      { peopleCount: 1, totalMonthlyCtc: 32500 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matched[0].name).toBe("T. Nkosi");
  });

  it("does not overwrite existing disability with blank", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E002",
          name: "A. Pillay",
          id_number: idB,
          disability: "",
          monthly_ctc: 41200,
        },
      ],
      [existingB],
      { peopleCount: 1, totalMonthlyCtc: 41200 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matched[0].disability).toBe("Yes");
  });

  it("puts invalid ID in exceptions and still processes other rows", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E003",
          name: "J. Botha",
          id_number: null,
          disability: "no",
          monthly_ctc: 28900,
        },
        {
          emp_no: "E001",
          name: "T. Nkosi",
          id_number: idA,
          disability: "N",
          monthly_ctc: 32500,
        },
      ],
      [],
      { peopleCount: 1, totalMonthlyCtc: 32500 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].reason).toMatch(/Missing ID/i);
    expect(result.new).toHaveLength(1);
  });

  it("refuses when control totals do not match", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E001",
          name: "T. Nkosi",
          id_number: idA,
          disability: "N",
          monthly_ctc: 32500,
        },
      ],
      [],
      { peopleCount: 99, totalMonthlyCtc: 0 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Control totals/i);
  });

  it("succeeds when header matches valid rows", () => {
    const result = importEmployees(
      [
        {
          emp_no: "E001",
          name: "T. Nkosi",
          id_number: idA,
          disability: "N",
          monthly_ctc: 32500,
        },
        {
          emp_no: "E002",
          name: "A. Pillay",
          id_number: idB,
          disability: "Yes",
          monthly_ctc: 41200,
        },
      ],
      [],
      { peopleCount: 2, totalMonthlyCtc: 73700 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.controls).toEqual({
      peopleCount: 2,
      totalMonthlyCtc: 73700,
    });
    expect(result.new).toHaveLength(2);
  });

  it("normalises mixed disability strings on one import", () => {
    const id1 = makeValidSaId("850101");
    const id2 = makeValidSaId("860202");
    const id3 = makeValidSaId("870303");
    const result = importEmployees(
      [
        {
          emp_no: "E1",
          name: "A",
          id_number: id1,
          disability: "N",
          monthly_ctc: 1000,
        },
        {
          emp_no: "E2",
          name: "B",
          id_number: id2,
          disability: "TRUE",
          monthly_ctc: 2000,
        },
        {
          emp_no: "E3",
          name: "C",
          id_number: id3,
          disability: "Disabled",
          monthly_ctc: 3000,
        },
      ],
      [],
      { peopleCount: 3, totalMonthlyCtc: 6000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.new.map((e) => e.disability)).toEqual([
      "No",
      "Yes",
      "Yes",
    ]);
  });

  it("uses sample-style rows: exceptions for bad IDs, header for valid only", () => {
    // Mixed valid and invalid IDs; only valid rows drive control totals.
    const result = importEmployees(
      [
        {
          emp_no: "E001",
          name: "T. Nkosi",
          id_number: idA,
          disability: "N",
          monthly_ctc: 32500,
        },
        {
          emp_no: "E002",
          name: "A. Pillay",
          id_number: idB,
          disability: "Yes",
          monthly_ctc: 41200,
        },
        {
          emp_no: "E003",
          name: "J. Botha",
          id_number: null,
          disability: "no",
          monthly_ctc: 28900,
        },
        {
          emp_no: "E004",
          name: "L. Dlamini",
          id_number: idC,
          disability: "TRUE",
          monthly_ctc: 19750,
        },
        {
          emp_no: "E005",
          name: "M. Smith",
          id_number: "7712319999999",
          disability: "",
          monthly_ctc: 55000,
        },
        {
          emp_no: "E006",
          name: "K. Mokoena",
          id_number: "9902305800086",
          disability: "Disabled",
          monthly_ctc: 18000,
        },
      ],
      [],
      { peopleCount: 3, totalMonthlyCtc: 93450 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.exceptions.length).toBeGreaterThanOrEqual(3);
    expect(result.new).toHaveLength(3);
    expect(result.controls.totalMonthlyCtc).toBe(93450);
  });
});
