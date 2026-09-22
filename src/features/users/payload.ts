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

/**
 * What the role picker asks for, relative to the role the user has now:
 * a role id to assign, "clear" to remove the role they have, or null when
 * nothing changed. A user with no role keeps their login and has no
 * permissions — the state a user provisioned without a role is already in.
 */
export const roleChangeFor = (
  existingRoleId: string | undefined,
  formRoleId: string | undefined,
): string | "clear" | null => {
  if (formRoleId) return formRoleId === existingRoleId ? null : formRoleId;
  return existingRoleId ? "clear" : null;
};
