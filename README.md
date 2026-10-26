# employees-import

TypeScript library that imports payroll employee rows: validates South African ID numbers, matches existing employees, normalises disability to `"Yes"` / `"No"`, and enforces client control totals (people count and total monthly CTC).

## How to run

Requires Node 20+.

```bash
npm install
npm test
npm run typecheck
```

## Decisions

- **Blank disability** → `"No"` for new rows. On match, blank/null disability in the file does **not** overwrite the value already on record.
- **Match order:** `id_number` first, then `emp_no`; otherwise treat as **new**.
- **Leavers:** people in `existing` who were not matched by any valid (non-exception) file row.
- **Blank overwrite:** blank/null file fields never overwrite existing values.
- **Control totals:** people count and sum of `monthly_ctc` use only valid imported rows (exceptions excluded). If they do not equal the header → refuse (`ok: false`); nothing is treated as a successful import.
- **SA ID:** 13 digits, real YYMMDD date of birth, citizenship digit `0` or `1`, Luhn check digit. Invalid rows go to `exceptions` with a reason and do not block other rows.

## Layout

```text
src/importEmployees.ts      # main import + Zod schemas
src/saId.ts                 # SA ID validation (+ test helper)
src/disability.ts           # disability → Yes/No
src/types.ts                # shared types
src/importEmployees.test.ts
```

## AI usage

- **Tools used:** Cursor for scaffolding the package, implementing `importEmployees` / SA ID / disability helpers, and drafting Vitest cases.
- **What they produced:** project layout, core modules, Zod input schemas, unit tests, this README.
- **What I changed / verified:** SA ID Luhn and date rules against generated valid IDs; blank disability must not overwrite on match; control totals ignore exceptions; mixed invalid IDs land in exceptions while valid rows still import.
- **How I checked:** `npm test` (22 passing) and `npm run typecheck`.
