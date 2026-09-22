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
 * edit a cleared text field is sent as "" and a cleared planning cap as 0 (no cap).
 * Only changed fields are sent on edit.
 */
export function buildDepartmentPayload(data: DepartmentDto, editing?: Department | null): Partial<DepartmentDto> {
  const rawCap = data.budgetLimit as unknown;
  const payload: DepartmentDto = {
    ...data,
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    departmentCode: data.departmentCode?.trim() ?? "",
    costCenterCode: data.costCenterCode?.trim() ?? "",
    budgetLimit: rawCap === undefined || rawCap === null || String(rawCap).trim() === "" ? 0 : Number(rawCap),
  };
  if (!editing) {
    if (!payload.description) delete payload.description;
    if (!payload.departmentCode) delete payload.departmentCode;
    if (!payload.costCenterCode) delete payload.costCenterCode;
    if (!payload.budgetLimit) delete payload.budgetLimit;
    return payload;
  }
  const previous: Partial<DepartmentDto> = {
    ...(editing as unknown as Partial<DepartmentDto>),
    description: editing.description ?? "",
    departmentCode: editing.departmentCode ?? "",
    costCenterCode: editing.costCenterCode ?? "",
    budgetLimit: editing.budgetLimit ?? 0,
  };
  return buildPatchPayload<DepartmentDto>(previous, payload);
}
