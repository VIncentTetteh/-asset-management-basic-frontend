"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { userService } from "@/services/userService";
import { departmentService } from "@/services/departmentService";
import { roleService } from "@/services/roleService";
import { mfaService } from "@/services/mfaService";
import { qk } from "@/lib/queryClient";
import type { User, UserDto } from "@/types";
import { buildPatchPayload } from "@/lib/patch";

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
    onError: () => toast.error("Failed to create user"),
  });
}

/** Profile fields go through PATCH; role changes go through /users/{id}/role. */
export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ existing, data }: { existing: User; data: UserDto }) => {
      const { password: _password, roleId, ...profileData } = data;
      const patch = buildPatchPayload<UserDto>(existing as unknown as Partial<UserDto>, profileData);
      if (Object.keys(patch).length > 0) {
        await userService.update(existing.id!, patch);
      }
      if (roleId && roleId !== existing.roleId) {
        await userService.assignRole(existing.id!, roleId);
      }
      return Object.keys(patch).length > 0 || (roleId && roleId !== existing.roleId);
    },
    onSuccess: (changed) => {
      if (changed) {
        toast.success("Profile updated");
      } else {
        toast("No changes to update");
      }
      invalidate();
    },
    onError: () => toast.error("Failed to save profile"),
  });
}

export function useDeactivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => userService.deactivate(id),
    onSuccess: () => {
      toast.success("User deactivated");
      invalidate();
    },
    onError: () => toast.error("Failed to deactivate user"),
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
    onError: () => toast.error("Failed to reset MFA"),
  });
}
