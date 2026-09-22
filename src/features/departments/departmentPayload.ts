import type { Department, DepartmentDto } from "@/types";
import { buildPatchPayload } from "@/lib/patch";

/** Statuses a department can have; mirrors the API's DepartmentStatus. */
export const DEPARTMENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

/**
 * Body for creating or updating a department. The API treats a missing field as
 * "unchanged" and an empty string as "clear" for the codes and description, so on
 * edit a cleared text field is sent as "". An empty planning cap means "no cap":
 * it is left out on create and sent as clearBudgetLimit on edit, so it is stored
 * as null and read back as "—" rather than as a cap of zero.
 * Only changed fields are sent on edit.
 */
export function buildDepartmentPayload(data: DepartmentDto, editing?: Department | null): Partial<DepartmentDto> {
  const rawCap = data.budgetLimit as unknown;
  const capIsEmpty = rawCap === undefined || rawCap === null || String(rawCap).trim() === "";
  const payload: DepartmentDto = {
    ...data,
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    departmentCode: data.departmentCode?.trim() ?? "",
    costCenterCode: data.costCenterCode?.trim() ?? "",
    budgetLimit: capIsEmpty ? undefined : Number(rawCap),
  };
  if (!editing) {
    if (!payload.description) delete payload.description;
    if (!payload.departmentCode) delete payload.departmentCode;
    if (!payload.costCenterCode) delete payload.costCenterCode;
    if (payload.budgetLimit === undefined) delete payload.budgetLimit;
    return payload;
  }
  const hadCap = editing.budgetLimit !== undefined && editing.budgetLimit !== null;
  if (capIsEmpty) delete payload.budgetLimit;
  const previous: Partial<DepartmentDto> = {
    ...(editing as unknown as Partial<DepartmentDto>),
    description: editing.description ?? "",
    departmentCode: editing.departmentCode ?? "",
    costCenterCode: editing.costCenterCode ?? "",
    budgetLimit: hadCap ? editing.budgetLimit : undefined,
  };
  const patch = buildPatchPayload<DepartmentDto>(previous, payload);
  if (capIsEmpty && hadCap) patch.clearBudgetLimit = true;
  return patch;
}
