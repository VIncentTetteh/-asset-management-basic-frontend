"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { userService } from "@/services/userService";
import { departmentService } from "@/services/departmentService";
import { roleService } from "@/services/roleService";
import { mfaService } from "@/services/mfaService";
import { qk } from "@/lib/queryClient";
import type { User, UserDto } from "@/types";
import { reportApiError } from "@/lib/api-validation";
import { buildUserProfileUpdate, roleChangeFor } from "@/features/users/payload";

const usersKey = qk.module("users");

export function useUsers() {
  return useQuery({
    queryKey: usersKey.list(),
    queryFn: () => userService.getAll(),
  });
}

export function useUserMasterData() {
  const departments = useQuery({
    queryKey: qk.module("departments").list(),
    queryFn: () => departmentService.getAll(),
    staleTime: 300_000,
  });
  const roles = useQuery({
    queryKey: qk.module("roles").list(),
    queryFn: () => roleService.getAll(),
    staleTime: 300_000,
  });
  return { departments: departments.data ?? [], roles: roles.data ?? [] };
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: usersKey.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (data: UserDto & { password: string }) => userService.create(data),
    onSuccess: () => {
      toast.success("User created");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to create user" }),
  });
}

/** Profile fields go through a full PUT; role changes go through /users/{id}/role (fresh MFA). */
export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ existing, data }: { existing: User; data: UserDto }) => {
      await userService.replaceProfile(existing.id!, buildUserProfileUpdate(existing, data));
      const roleId = roleChangeFor(existing.roleId, data.roleId);
      if (roleId) {
        await userService.assignRole(existing.id!, roleId);
      }
    },
    onSuccess: () => {
      toast.success("User updated");
      invalidate();
    },
    // Shows step-up cancellation, 403 escalation refusals and field errors.
    onError: (err) => reportApiError(err, { fallback: "Failed to save user" }),
  });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? userService.activate(id) : userService.deactivate(id),
    onSuccess: (_res, vars) => {
      toast.success(vars.active ? "User reactivated" : "User deactivated");
      invalidate();
    },
    onError: (err, vars) => reportApiError(err, { fallback: `Failed to ${vars.active ? "reactivate" : "deactivate"} user` }),
  });
}

export function useResetMfa() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => mfaService.adminReset(id),
    onSuccess: (result) => {
      toast.success((result as { message?: string })?.message || "MFA reset");
      invalidate();
    },
    onError: (err) => reportApiError(err, { fallback: "Failed to reset MFA" }),
  });
}
