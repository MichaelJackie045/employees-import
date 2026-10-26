export type DisabilityYesNo = "Yes" | "No";

export type EmployeeRow = {
  emp_no?: string | null;
  name?: string | null;
  id_number?: string | null;
  disability?: unknown;
  monthly_ctc?: number | string | null;
};

export type ExistingEmployee = {
  emp_no: string;
  name: string;
  id_number: string;
  disability: DisabilityYesNo;
  monthly_ctc: number;
};

export type ImportHeader = {
  peopleCount: number;
  totalMonthlyCtc: number;
};

export type ExceptionRow = {
  row: EmployeeRow;
  reason: string;
};

export type ImportSuccess = {
  ok: true;
  matched: ExistingEmployee[];
  new: ExistingEmployee[];
  leavers: ExistingEmployee[];
  exceptions: ExceptionRow[];
  controls: { peopleCount: number; totalMonthlyCtc: number };
};

export type ImportFailure = {
  ok: false;
  error: string;
  exceptions?: ExceptionRow[];
};

export type ImportResult = ImportSuccess | ImportFailure;
