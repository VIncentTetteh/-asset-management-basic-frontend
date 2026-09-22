import type { User, UserDto } from "@/types";
import type { UserProfileUpdate } from "@/services/userService";
import { optionalString } from "@/features/finance/payloads";

/**
 * Full PUT /users/{id} body. The old PATCH diff dropped blank fields, so a phone,
 * job title or department could never be removed; the employee id (not on the
 * form) is carried from the record so a save does not clear it.
 */
export function buildUserProfileUpdate(existing: Pick<User, "email" | "employeeId">, form: UserDto): UserProfileUpdate {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: existing.email,
    phone: optionalString(form.phone),
    jobTitle: optionalString(form.jobTitle),
    employeeId: existing.employeeId ?? null,
    departmentId: optionalString(form.departmentId),
  };
}

/** The API has no "remove role" operation: a role can be changed, not cleared. */
export const roleChangeFor = (existingRoleId: string | undefined, formRoleId: string | undefined): string | null =>
  formRoleId && formRoleId !== existingRoleId ? formRoleId : null;
